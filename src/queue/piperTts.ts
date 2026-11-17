"use client";

import {
  DEFAULT_PIPER_VOICE_CHOICE,
  PIPER_VOICE_CHOICES,
  type PiperVoiceChoice,
  isPiperVoiceChoice,
  piperModelPublicPaths,
  resolvePiperModelId,
} from "@/queue/piperVoices";

const UNLOCK_KEY = "lh-queue-voice-unlocked";
export const TTS_UNLOCK_PHRASE = "Queue announcements are enabled.";

/** RemoteVoiceProvider resolves models from this base (see piper-tts-web). */
const LOCAL_VOICE_BASE = "/piper/models/";

type PiperModule = typeof import("piper-tts-web");

type PiperEngine = {
  generate: (text: string, voice: string, speaker?: number) => Promise<{ file: Blob }>;
};

let activeVoiceChoice: PiperVoiceChoice = DEFAULT_PIPER_VOICE_CHOICE;
let enginePromise: Promise<PiperEngine> | null = null;
let preloadPromise: Promise<void> | null = null;
/** Piper `generate` must not run concurrently (parallel ONNX load can hang). */
let warmChain: Promise<unknown> = Promise.resolve();
const loadedVoices = new Set<string>();
const audioBlobCache = new Map<string, Blob>();
const MAX_CACHE = 120;

function cacheKey(text: string, modelId: string): string {
  return `${modelId}:${text.trim()}`;
}

function activeModelId(): string {
  return resolvePiperModelId(activeVoiceChoice);
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getActivePiperVoice(): PiperVoiceChoice {
  return activeVoiceChoice;
}

export function setActivePiperVoice(choice: PiperVoiceChoice): void {
  if (choice === activeVoiceChoice) return;
  activeVoiceChoice = choice;
  preloadPromise = null;
}

export function isPiperVoiceModelLoaded(choice: PiperVoiceChoice): boolean {
  return loadedVoices.has(resolvePiperModelId(choice));
}

/** Clear in-flight boot so Retry / a new effect does not await a stale promise. */
export function resetPiperVoiceBoot(options?: { resetEngine?: boolean }): void {
  preloadPromise = null;
  warmChain = Promise.resolve();
  if (options?.resetEngine) {
    enginePromise = null;
  }
}

function runSerializedWarm<T>(work: () => Promise<T>): Promise<T> {
  const run = warmChain.then(work, work);
  warmChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function setActivePiperVoiceFromConfig(value: string | null | undefined): void {
  const choice = isPiperVoiceChoice(value) ? value : DEFAULT_PIPER_VOICE_CHOICE;
  setActivePiperVoice(choice);
}

export function isAnnouncementAudioUnlocked(): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(UNLOCK_KEY) === "1";
}

export function setAnnouncementAudioUnlocked(unlocked: boolean): void {
  if (!canUseStorage()) return;
  localStorage.setItem(UNLOCK_KEY, unlocked ? "1" : "0");
}

/** User gesture: unlock browser autoplay and confirm Piper playback. */
export async function unlockAnnouncementAudio(): Promise<boolean> {
  try {
    const blob = await synthesizePiperSpeech(TTS_UNLOCK_PHRASE);
    await playUnlockBlob(blob);
    setAnnouncementAudioUnlocked(true);
    return true;
  } catch {
    setAnnouncementAudioUnlocked(false);
    return false;
  }
}

let currentUnlockAudio: HTMLAudioElement | null = null;

function playUnlockBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentUnlockAudio = audio;
    const finish = (ok: boolean) => {
      URL.revokeObjectURL(url);
      if (currentUnlockAudio === audio) currentUnlockAudio = null;
      if (ok) resolve();
      else reject(new Error("Playback blocked"));
    };
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    void audio.play().catch(() => finish(false));
  });
}

export type PiperBootPhase = "checking" | "engine" | "model" | "warmup";

export const PIPER_BOOT_PHASE_LABELS: Record<PiperBootPhase, string> = {
  checking: "Checking voice files…",
  engine: "Starting voice engine…",
  model: "Downloading voice model…",
  warmup: "Warming up announcements…",
};

export async function verifyPiperAssets(): Promise<void> {
  if (typeof window === "undefined") return;

  const wasm = await fetch("/piper/piper_phonemize.wasm", { method: "HEAD" });
  if (!wasm.ok) {
    throw new Error(`Piper wasm missing at /piper (HTTP ${wasm.status}). Run npm run copy:piper.`);
  }

  const engine = await fetch("/piper-tts-web.js", { method: "HEAD" });
  if (!engine.ok) {
    throw new Error(`Piper engine missing at /piper-tts-web.js (HTTP ${engine.status}). Run npm run copy:piper.`);
  }

  const modelId = activeModelId();
  const { onnx, config } = piperModelPublicPaths(modelId);
  // HEAD only — do not download the full ~60MB .onnx twice (verify + generate).
  const [onnxRes, cfgRes] = await Promise.all([
    fetch(onnx, { method: "HEAD" }),
    fetch(config, { method: "HEAD" }),
  ]);
  if (!onnxRes.ok || !cfgRes.ok) {
    throw new Error(
      `Voice model missing on server (HTTP ${onnxRes.status}/${cfgRes.status}). Run: npm run download:piper-voices`,
    );
  }
}

async function loadPiperModule(): Promise<PiperModule> {
  const href = "/piper-tts-web.js";
  return import(/* webpackIgnore: true */ href);
}

export type PreloadPiperOptions = {
  onPhase?: (phase: PiperBootPhase) => void;
};

async function getEngine(onPhase?: (phase: PiperBootPhase) => void): Promise<PiperEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      onPhase?.("checking");
      await verifyPiperAssets();
      onPhase?.("engine");
      const mod = await loadPiperModule();
      const voiceProvider = new mod.RemoteVoiceProvider({ baseUrl: LOCAL_VOICE_BASE });
      // Must be single-threaded: /queue is crossOriginIsolated (COOP/COEP), so ORT would
      // otherwise spawn one pthread worker per core, each re-importing the 46MB bundle
      // via import.meta.url — session creation never resolves (stuck on "Warming up").
      const onnxRuntime = new mod.OnnxWebRuntime({ basePath: "/onnx/", numThreads: 1 });
      return new mod.PiperWebEngine({ voiceProvider, onnxRuntime }) as PiperEngine;
    })().catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

/** First TV load: download + ONNX init + first generate can exceed 5 min on lobby hardware. */
const PRELOAD_TIMEOUT_MS = 900_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

/** Fetch ONNX + config into the browser HTTP cache (once per asset per browser). */
export async function primePiperModelCache(choice: PiperVoiceChoice): Promise<void> {
  if (typeof window === "undefined") return;
  const modelId = resolvePiperModelId(choice);
  const { onnx, config } = piperModelPublicPaths(modelId);
  await Promise.all([fetch(config), fetch(onnx)]);
}

/** Warm a specific model without changing the active announcement voice. */
export async function warmPiperVoiceModel(choice: PiperVoiceChoice): Promise<void> {
  if (typeof window === "undefined") return;
  const modelId = resolvePiperModelId(choice);
  if (loadedVoices.has(modelId)) return;
  await runSerializedWarm(async () => {
    if (loadedVoices.has(modelId)) return;
    const engine = await getEngine();
    const response = await engine.generate("Ready.", modelId, 0);
    loadedVoices.add(modelId);
    void response.file;
  });
}

/** Download remaining voices in the background after the active one is ready. */
export function prefetchRemainingPiperVoiceModels(): void {
  if (typeof window === "undefined") return;
  void (async () => {
    await new Promise((r) => setTimeout(r, 4000));
    for (const choice of PIPER_VOICE_CHOICES) {
      if (isPiperVoiceModelLoaded(choice)) continue;
      try {
        await primePiperModelCache(choice);
        await warmPiperVoiceModel(choice);
      } catch {
        /* background optional */
      }
    }
  })();
}

/** Warm engine + voice model using /public/piper assets. */
export async function preloadPiperVoice(options?: PreloadPiperOptions): Promise<void> {
  if (typeof window === "undefined") return;

  const modelId = activeModelId();
  if (loadedVoices.has(modelId) && enginePromise) return;

  const onPhase = options?.onPhase;

  if (!preloadPromise) {
    const choice = getActivePiperVoice();
    preloadPromise = withTimeout(
      runSerializedWarm(async () => {
        onPhase?.("model");
        await primePiperModelCache(choice);
        const engine = await getEngine(onPhase);
        onPhase?.("warmup");
        const response = await engine.generate("Ready.", modelId, 0);
        loadedVoices.add(modelId);
        void response.file;
      }),
      PRELOAD_TIMEOUT_MS,
      "Voice warmup timed out. Download may be cached—tap Retry (warmup on TV can take 10+ minutes the first time).",
    )
      .catch((err) => {
        enginePromise = null;
        throw err;
      })
      .finally(() => {
        preloadPromise = null;
      });
  }

  await preloadPromise;
}

export async function synthesizePiperSpeech(text: string): Promise<Blob> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty announcement text");

  const modelId = activeModelId();
  const key = cacheKey(trimmed, modelId);
  const cached = audioBlobCache.get(key);
  if (cached) return cached;

  const engine = await getEngine();
  const response = await engine.generate(trimmed, modelId, 0);
  loadedVoices.add(modelId);

  if (audioBlobCache.size >= MAX_CACHE) {
    const first = audioBlobCache.keys().next().value;
    if (first !== undefined) audioBlobCache.delete(first);
  }
  audioBlobCache.set(key, response.file);
  return response.file;
}

/** Prefetch announcement audio into memory (no playback). */
export async function prefetchPiperSpeech(text: string): Promise<void> {
  try {
    await synthesizePiperSpeech(text);
  } catch {
    /* optional warm-up */
  }
}