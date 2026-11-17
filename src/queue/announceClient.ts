"use client";

import {
  isAnnouncementAudioUnlocked,
  prefetchPiperSpeech,
  preloadPiperVoice,
  synthesizePiperSpeech,
} from "@/queue/piperTts";

export type AnnouncementVoice = "primary" | "bisaya";

const prefetchedTexts = new Set<string>();
const pendingClips: AnnouncementClip[] = [];

export type AnnouncementClip = {
  text: string;
  voice?: AnnouncementVoice;
};

let activeAudio: HTMLAudioElement | null = null;
let activeSequenceId = 0;
let piperReadyPromise: Promise<void> | null = null;

function stopActive(): void {
  if (!activeAudio) return;
  try {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
  } catch {
    /* ignore */
  }
  activeAudio = null;
}

function speakViaSynthesis(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

function ensurePiperReady(): Promise<void> {
  if (!piperReadyPromise) {
    piperReadyPromise = preloadPiperVoice().catch((err) => {
      piperReadyPromise = null;
      throw err;
    });
  }
  return piperReadyPromise;
}

/** Warm Piper (/public/piper) without playing audio. */
export function prefetchAnnouncement(text: string, voice?: AnnouncementVoice): void {
  if (typeof window === "undefined") return;
  const trimmed = text.trim();
  if (!trimmed) return;
  const cacheKey = voice ? `${voice}:${trimmed}` : trimmed;
  if (prefetchedTexts.has(cacheKey)) return;
  prefetchedTexts.add(cacheKey);

  void ensurePiperReady()
    .then(() => prefetchPiperSpeech(trimmed))
    .catch(() => {
      prefetchedTexts.delete(cacheKey);
    });
}

function playBlobAndWait(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);

  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    audio.preload = "auto";
    activeAudio = audio;

    let settled = false;
    const finish = (ok: boolean, err?: unknown) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      if (activeAudio === audio) activeAudio = null;
      if (ok) resolve();
      else reject(err instanceof Error ? err : new Error("Audio playback failed"));
    };

    audio.addEventListener("ended", () => finish(true), { once: true });
    audio.addEventListener("error", () => finish(false), { once: true });

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err: unknown) => finish(false, err));
    }
  });
}

function playClip(clip: AnnouncementClip): Promise<void> {
  const text = clip.text.trim();

  return ensurePiperReady()
    .then(() => synthesizePiperSpeech(text))
    .then((blob) => playBlobAndWait(blob));
}

function runSequence(list: AnnouncementClip[]): void {
  cancelAnnouncement();
  const sequenceId = ++activeSequenceId;

  void (async () => {
    for (const clip of list) {
      if (sequenceId !== activeSequenceId) return;
      try {
        await playClip(clip);
      } catch (err) {
        console.warn("[voice] Piper playback failed, using browser voice", err);
        if (sequenceId !== activeSequenceId) return;
        await speakViaSynthesis(clip.text);
      }
    }
  })();
}

/**
 * Speak announcements with Piper (public/piper). Falls back to browser
 * speechSynthesis when Piper or autoplay fails. Requires one-time audio unlock.
 */
export function speakAnnouncement(clips: AnnouncementClip[] | string): void {
  if (typeof window === "undefined") return;

  const list: AnnouncementClip[] =
    typeof clips === "string"
      ? [{ text: clips }]
      : clips.filter((c) => c && c.text && c.text.trim().length > 0);
  if (!list.length) return;

  if (!isAnnouncementAudioUnlocked()) {
    for (const clip of list) {
      if (!pendingClips.some((p) => p.text === clip.text)) pendingClips.push(clip);
    }
    return;
  }

  runSequence(list);
}

/** Call after staff taps Enable sound — plays any announcements that arrived while locked. */
export function flushPendingAnnouncements(): void {
  if (!isAnnouncementAudioUnlocked() || pendingClips.length === 0) return;
  const list = pendingClips.splice(0, pendingClips.length);
  runSequence(list);
}

export function cancelAnnouncement(): void {
  activeSequenceId++;
  stopActive();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

export { formatQueueForSpeech } from "@/queue/announceText";