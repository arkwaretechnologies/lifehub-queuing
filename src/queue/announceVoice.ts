import "server-only";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const DEFAULT_MODEL_ID = "eleven_flash_v2_5";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

export const ANNOUNCEMENT_VOICES = ["primary", "bisaya"] as const;
export type AnnouncementVoice = (typeof ANNOUNCEMENT_VOICES)[number];

export function isAnnouncementVoice(value: string | null | undefined): value is AnnouncementVoice {
  return !!value && (ANNOUNCEMENT_VOICES as readonly string[]).includes(value);
}

let cachedClient: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  cachedClient = new ElevenLabsClient({ apiKey });
  return cachedClient;
}

function resolveVoiceId(voice: AnnouncementVoice): string {
  switch (voice) {
    case "bisaya": {
      const id = process.env.ELEVENLABS_VOICE_ID_BISAYA;
      if (!id) throw new Error("ELEVENLABS_VOICE_ID_BISAYA is not configured");
      return id;
    }
    case "primary":
    default: {
      const id = process.env.ELEVENLABS_VOICE_ID;
      if (!id) throw new Error("ELEVENLABS_VOICE_ID is not configured");
      return id;
    }
  }
}

export function isVoiceConfigured(voice: AnnouncementVoice): boolean {
  if (!process.env.ELEVENLABS_API_KEY) return false;
  if (voice === "bisaya") return Boolean(process.env.ELEVENLABS_VOICE_ID_BISAYA);
  return Boolean(process.env.ELEVENLABS_VOICE_ID);
}

export function isElevenLabsConfigured(): boolean {
  return isVoiceConfigured("primary");
}

async function synthesizeAnnouncement(text: string, voice: AnnouncementVoice): Promise<ArrayBuffer> {
  const voiceId = resolveVoiceId(voice);
  const client = getClient();
  // The SDK returns a web ReadableStream<Uint8Array> for `convert()`. We collect
  // it into a single buffer so it can be cached and served with Content-Length.
  const stream = (await client.textToSpeech.convert(voiceId, {
    text,
    modelId: DEFAULT_MODEL_ID,
    outputFormat: DEFAULT_OUTPUT_FORMAT,
  })) as unknown as ReadableStream<Uint8Array>;

  return await new Response(stream).arrayBuffer();
}

// Simple LRU keyed by `${voice}::${text}`. Queue announcements repeat heavily
// ("Now serving G-001. Please proceed to Counter 1.") so caching here avoids
// hammering ElevenLabs for identical playbacks across reloads / screens.
const audioCache = new Map<string, ArrayBuffer>();
const inflight = new Map<string, Promise<ArrayBuffer>>();
const MAX_CACHE_ENTRIES = 200;

function cacheKey(text: string, voice: AnnouncementVoice): string {
  return `${voice}::${text}`;
}

export async function getCachedAnnouncement(
  text: string,
  voice: AnnouncementVoice = "primary",
): Promise<ArrayBuffer> {
  const key = cacheKey(text, voice);

  const cached = audioCache.get(key);
  if (cached) {
    audioCache.delete(key);
    audioCache.set(key, cached);
    return cached;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const buf = await synthesizeAnnouncement(text, voice);
    if (audioCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey !== undefined) audioCache.delete(firstKey);
    }
    audioCache.set(key, buf);
    return buf;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}
