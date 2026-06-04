"use client";

import { announcementUrlForText } from "@/queue/announceText";

export type AnnouncementVoice = "primary" | "bisaya";

const prefetchedTexts = new Set<string>();

export type AnnouncementClip = {
  text: string;
  /** Defaults to "primary" (the English voice). */
  voice?: AnnouncementVoice;
};

let activeAudio: HTMLAudioElement | null = null;
let activeSequenceId = 0;

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

/** Warm server + browser cache without playing audio. Safe to call repeatedly. */
export function prefetchAnnouncement(text: string, voice?: AnnouncementVoice): void {
  if (typeof window === "undefined") return;
  const trimmed = text.trim();
  if (!trimmed) return;
  const cacheKey = voice ? `${voice}:${trimmed}` : trimmed;
  if (prefetchedTexts.has(cacheKey)) return;
  prefetchedTexts.add(cacheKey);

  const url = announcementUrlForText(trimmed, voice);
  void fetch(url).catch(() => {
    prefetchedTexts.delete(cacheKey);
  });
}

function playClip(clip: AnnouncementClip): Promise<void> {
  const url = announcementUrlForText(clip.text, clip.voice);

  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.load();
    activeAudio = audio;

    let settled = false;
    const finish = (ok: boolean, err?: unknown) => {
      if (settled) return;
      settled = true;
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

/**
 * Speak a sequence of announcement clips back-to-back. Any in-flight sequence
 * is interrupted before the new one starts. Each clip falls back to the
 * browser's SpeechSynthesis if ElevenLabs / autoplay fails for that clip.
 */
export function speakAnnouncement(clips: AnnouncementClip[] | string): void {
  if (typeof window === "undefined") return;

  const list: AnnouncementClip[] =
    typeof clips === "string"
      ? [{ text: clips }]
      : clips.filter((c) => c && c.text && c.text.trim().length > 0);
  if (!list.length) return;

  cancelAnnouncement();
  const sequenceId = ++activeSequenceId;

  void (async () => {
    for (const clip of list) {
      if (sequenceId !== activeSequenceId) return; // superseded by a newer call
      try {
        await playClip(clip);
      } catch {
        if (sequenceId !== activeSequenceId) return;
        // Fall back to browser TTS for this clip and wait for it to finish so
        // the next clip in the sequence doesn't overlap.
        await speakViaSynthesis(clip.text);
      }
    }
  })();
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
