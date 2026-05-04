"use client";

export type AnnouncementVoice = "primary" | "bisaya";

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

function playClip(clip: AnnouncementClip): Promise<void> {
  const params = new URLSearchParams({ text: clip.text });
  if (clip.voice) params.set("voice", clip.voice);
  const url = `/api/tts/announce?${params.toString()}`;

  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    audio.preload = "auto";
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

/**
 * Format a queue display ("G-001") so TTS pronounces digits individually
 * ("G-0 0 1" → "G dash zero zero one") instead of as a multi-digit number.
 */
export function formatQueueForSpeech(display: string): string {
  return display.replace(/\d{2,}/g, (match) => match.split("").join(" "));
}
