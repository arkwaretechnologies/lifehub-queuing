"use client";

/**
 * Lobby voice volume (0..2 = 0%..200%).
 *
 * HTMLAudioElement.volume caps at 1.0 and raw Piper output is quiet (peaks ~0.3, RMS ~-26..-29 dBFS),
 * so loudness is raised in the PCM itself before playback:
 *  - every clip is normalised to the same RMS (also evens out female vs male voices),
 *  - above 100% an extra gain (up to +6 dB at 200%) is applied,
 *  - a soft limiter keeps peaks under full scale so boosted speech does not crackle.
 * Below 100% the element volume attenuates the normalised clip.
 * Optional echo (0..100%) is mixed in before the limiter.
 */

const STORAGE_KEY = "lh-queue-voice-volume";
export const VOICE_VOLUME_MIN = 0;
export const VOICE_VOLUME_MAX = 2;
export const DEFAULT_VOICE_VOLUME = 1;

/** Target loudness at 100% (dBFS RMS). */
const TARGET_RMS = 10 ** (-18 / 20);
/** Never amplify more than this from normalisation alone (protects near-silent clips). */
const MAX_NORMALISE_GAIN = 8;
const LIMIT_THRESHOLD = 0.7;
const LIMIT_CEILING = 0.98;

const ECHO_STORAGE_KEY = "lh-queue-voice-echo";
/** 0..1 (0%..100%); 0 = dry voice. */
export const DEFAULT_VOICE_ECHO = 0;

let currentVolume = DEFAULT_VOICE_VOLUME;
let currentEcho = DEFAULT_VOICE_ECHO;
const playing = new Set<HTMLAudioElement>();

function clamp(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_VOICE_VOLUME;
  return Math.min(VOICE_VOLUME_MAX, Math.max(VOICE_VOLUME_MIN, v));
}

export function readStoredVoiceVolume(): number {
  if (typeof window === "undefined") return DEFAULT_VOICE_VOLUME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_VOICE_VOLUME;
    return clamp(Number(raw));
  } catch {
    return DEFAULT_VOICE_VOLUME;
  }
}

export function getVoiceVolume(): number {
  return currentVolume;
}

/** Updates the level, persists it, and adjusts any clip that is currently playing. */
export function setVoiceVolume(value: number, persist = true): void {
  currentVolume = clamp(value);
  if (persist && typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, String(currentVolume));
    } catch {
      /* storage unavailable — keep in memory */
    }
  }
  for (const el of playing) el.volume = Math.min(1, currentVolume);
}

/** Load the stored level into memory (call once on mount). */
export function initVoiceVolume(): number {
  setVoiceVolume(readStoredVoiceVolume(), false);
  return currentVolume;
}

function clampEcho(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_VOICE_ECHO;
  return Math.min(1, Math.max(0, v));
}

export function getVoiceEcho(): number {
  return currentEcho;
}

/** Echo amount for the next clip (already-playing audio keeps its echo). */
export function setVoiceEcho(value: number, persist = true): void {
  currentEcho = clampEcho(value);
  if (persist && typeof window !== "undefined") {
    try {
      localStorage.setItem(ECHO_STORAGE_KEY, String(currentEcho));
    } catch {
      /* storage unavailable — keep in memory */
    }
  }
}

/** Load the stored echo into memory (call once on mount). */
export function initVoiceEcho(): number {
  let stored = DEFAULT_VOICE_ECHO;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(ECHO_STORAGE_KEY);
      if (raw !== null) stored = clampEcho(Number(raw));
    } catch {
      /* ignore */
    }
  }
  setVoiceEcho(stored, false);
  return currentEcho;
}

/**
 * PA-style echo: a feedback delay whose repeats are low-pass damped (each repeat duller, like a
 * hall), with delay time, feedback and mix all growing with `amount`. Output includes the tail.
 */
function addEcho(dry: Float32Array, sampleRate: number, amount: number): Float32Array {
  if (amount <= 0) return dry;
  const delay = Math.max(1, Math.round(sampleRate * (0.12 + 0.13 * amount)));
  const feedback = 0.2 + 0.35 * amount;
  const wet = 0.15 + 0.45 * amount;
  const repeats = Math.ceil(Math.log(0.003 / wet) / Math.log(feedback));
  const tail = Math.min(Math.round(sampleRate * 2.5), repeats * delay);

  const out = new Float32Array(dry.length + tail);
  const line = new Float32Array(out.length);
  // One-pole low-pass on the echo path (~2.5 kHz) so repeats sit behind the speech.
  const alpha = 1 - Math.exp((-2 * Math.PI * 2500) / sampleRate);
  let lp = 0;
  for (let n = 0; n < out.length; n++) {
    const x = n < dry.length ? dry[n] : 0;
    if (n >= delay) {
      const src = (n - delay < dry.length ? dry[n - delay] : 0) + feedback * line[n - delay];
      lp += alpha * (src - lp);
      line[n] = lp;
    }
    out[n] = x + wet * line[n];
  }
  return out;
}

function encodeWav16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  v.setUint32(0, 0x52494646, false); // RIFF
  v.setUint32(4, buf.byteLength - 8, true);
  v.setUint32(8, 0x57415645, false); // WAVE
  v.setUint32(12, 0x666d7420, false); // "fmt "
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  v.setUint32(36, 0x64617461, false); // data
  v.setUint32(40, samples.length * 2, true);
  const pcm = new Int16Array(buf, 44, samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.round(samples[i] * 32767);
  return buf;
}

function softLimit(x: number): number {
  const a = Math.abs(x);
  if (a <= LIMIT_THRESHOLD) return x;
  const span = LIMIT_CEILING - LIMIT_THRESHOLD;
  return Math.sign(x) * (LIMIT_THRESHOLD + span * Math.tanh((a - LIMIT_THRESHOLD) / span));
}

/** Locate the PCM "data" chunk of a 16-bit WAV. */
function findDataChunk(view: DataView): { offset: number; length: number } | null {
  let pos = 12;
  while (pos + 8 <= view.byteLength) {
    const id = view.getUint32(pos, false);
    const size = view.getUint32(pos + 4, true);
    if (id === 0x64617461 /* "data" */) {
      return { offset: pos + 8, length: Math.min(size, view.byteLength - pos - 8) };
    }
    pos += 8 + size + (size % 2);
  }
  return null;
}

/**
 * Returns a processed copy of a Piper WAV: loudness-normalised, echo added, boosted above 100%,
 * then soft-limited. Loudness is measured on the dry voice so echo does not make speech quieter.
 */
export async function applyVoiceLoudness(
  wav: Blob,
  volume = currentVolume,
  echo = currentEcho,
): Promise<Blob> {
  const buffer = await wav.arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 44 || view.getUint32(0, false) !== 0x52494646 /* "RIFF" */) return wav;
  if (view.getUint16(34, true) !== 16 || view.getUint16(22, true) !== 1) return wav;
  const sampleRate = view.getUint32(24, true);
  const data = findDataChunk(view);
  if (!data || data.length < 2) return wav;

  const samples = new Int16Array(buffer, data.offset, Math.floor(data.length / 2));
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] / 32768;
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / samples.length);
  if (rms < 1e-5) return wav;

  const gain = Math.min(MAX_NORMALISE_GAIN, TARGET_RMS / rms) * Math.max(1, volume);
  const dry = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) dry[i] = (samples[i] / 32768) * gain;
  const mixed = addEcho(dry, sampleRate, clampEcho(echo));
  for (let i = 0; i < mixed.length; i++) mixed[i] = softLimit(mixed[i]);
  return new Blob([encodeWav16(mixed, sampleRate)], { type: wav.type || "audio/wav" });
}

/** Keep an element's volume in step with the slider (capped at 100%); returns an untrack fn. */
export function trackAudioVolume(audio: HTMLAudioElement): () => void {
  playing.add(audio);
  return () => {
    playing.delete(audio);
  };
}

/** Prepare a clip for playback at the current level and track it for live volume changes. */
export async function createVoiceAudio(wav: Blob): Promise<{ audio: HTMLAudioElement; release: () => void }> {
  const processed = await applyVoiceLoudness(wav);
  const url = URL.createObjectURL(processed);
  const audio = new Audio(url);
  audio.volume = Math.min(1, currentVolume);
  playing.add(audio);
  return {
    audio,
    release: () => {
      playing.delete(audio);
      URL.revokeObjectURL(url);
    },
  };
}
