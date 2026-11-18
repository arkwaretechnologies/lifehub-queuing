"use client";

import {
  isAnnouncementAudioUnlocked,
  prefetchPiperSpeech,
  preloadPiperVoice,
  synthesizePiperSpeech,
} from "@/queue/piperTts";
import { createVoiceAudio, getVoiceVolume } from "@/queue/voiceVolume";
import { playChimeLead, preloadChime, stopChime } from "@/queue/chime";

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
      utterance.volume = Math.min(1, getVoiceVolume());
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
  void preloadChime().catch(() => {});
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

async function playBlobAndWait(blob: Blob): Promise<void> {
  const { audio, release } = await createVoiceAudio(blob);

  return new Promise<void>((resolve, reject) => {
    audio.preload = "auto";
    activeAudio = audio;

    let settled = false;
    const finish = (ok: boolean, err?: unknown) => {
      if (settled) return;
      settled = true;
      release();
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

function synthesizeClip(clip: AnnouncementClip): Promise<Blob> {
  const text = clip.text.trim();
  return ensurePiperReady().then(() => synthesizePiperSpeech(text));
}

function runSequence(list: AnnouncementClip[]): void {
  cancelAnnouncement();
  const sequenceId = ++activeSequenceId;

  void (async () => {
    // Generate the first clip while the chime plays, so the chime→speech gap stays at
    // CHIME_LEAD_MS instead of growing by synthesis time.
    const firstBlob = synthesizeClip(list[0]);
    firstBlob.catch(() => {
      /* handled when awaited below */
    });
    await playChimeLead();

    for (let i = 0; i < list.length; i++) {
      const clip = list[i];
      if (sequenceId !== activeSequenceId) return;
      try {
        const blob = await (i === 0 ? firstBlob : synthesizeClip(clip));
        if (sequenceId !== activeSequenceId) return;
        await playBlobAndWait(blob);
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
  stopChime();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

export { formatQueueForSpeech } from "@/queue/announceText";