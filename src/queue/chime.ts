"use client";

import { getVoiceVolume, trackAudioVolume } from "@/queue/voiceVolume";

/** Attention chime played once before each announcement (and the voice test). */
const CHIME_URL = "/sfxmint-ui-chime-58.wav";

/**
 * When speech starts, measured from the start of the chime. The file is 2.0 s long but its
 * audible part (main hit at ~0.3 s) has faded to ~-40 dB by ~1.2 s; the rest is near-silent tail,
 * so speech starts there and the tail keeps ringing underneath. Raise for a longer pause,
 * lower to tighten it.
 */
export const CHIME_LEAD_MS = 1200;

let chimeUrlPromise: Promise<string> | null = null;
let activeChime: { audio: HTMLAudioElement; release: () => void } | null = null;

/** Fetch the chime once into memory so it plays instantly (call early, e.g. on page load). */
export function preloadChime(): Promise<string> {
  if (!chimeUrlPromise) {
    chimeUrlPromise = fetch(CHIME_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Chime missing (HTTP ${res.status})`);
        return res.blob();
      })
      .then((blob) => URL.createObjectURL(blob))
      .catch((err) => {
        chimeUrlPromise = null;
        throw err;
      });
  }
  return chimeUrlPromise;
}

export function stopChime(): void {
  if (!activeChime) return;
  const { audio, release } = activeChime;
  activeChime = null;
  release();
  try {
    audio.pause();
  } catch {
    /* ignore */
  }
}

/**
 * Start the chime and resolve after CHIME_LEAD_MS (or when it ends / fails, whichever is first).
 * The chime keeps playing its tail after this resolves. Never rejects: a missing or blocked chime
 * must not stop the announcement itself.
 */
export async function playChimeLead(): Promise<void> {
  if (typeof window === "undefined") return;
  if (getVoiceVolume() <= 0) return;

  let url: string;
  try {
    url = await preloadChime();
  } catch (err) {
    console.warn("[voice] chime unavailable", err);
    return;
  }

  stopChime();
  const audio = new Audio(url);
  audio.volume = Math.min(1, getVoiceVolume());
  const untrack = trackAudioVolume(audio);
  const entry = {
    audio,
    release: () => {
      untrack();
      if (activeChime === entry) activeChime = null;
    },
  };
  activeChime = entry;
  // Let the tail ring out after speech starts; clean up when it really ends.
  audio.addEventListener("ended", entry.release, { once: true });
  audio.addEventListener("error", entry.release, { once: true });

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, CHIME_LEAD_MS);
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    void audio.play().catch(finish);
  });
}
