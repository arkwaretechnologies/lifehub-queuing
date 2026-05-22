import "server-only";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL_ID = "eleven_flash_v2_5";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

export const ANNOUNCEMENT_VOICES = ["primary"] as const;
export type AnnouncementVoice = (typeof ANNOUNCEMENT_VOICES)[number];

export function isAnnouncementVoice(value: string | null | undefined): value is AnnouncementVoice {
  return !!value && (ANNOUNCEMENT_VOICES as readonly string[]).includes(value);
}

function getApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");
  return apiKey;
}

function resolveVoiceId(): string {
  const id = process.env.ELEVENLABS_VOICE_ID;
  if (!id) throw new Error("ELEVENLABS_VOICE_ID is not configured");
  return id;
}

export function isVoiceConfigured(voice: AnnouncementVoice): boolean {
  if (!process.env.ELEVENLABS_API_KEY) return false;
  return Boolean(process.env.ELEVENLABS_VOICE_ID);
}

export function isElevenLabsConfigured(): boolean {
  return isVoiceConfigured("primary");
}

async function synthesizeAnnouncement(text: string): Promise<ArrayBuffer> {
  const voiceId = resolveVoiceId();
  const url = new URL(`${ELEVENLABS_API}/text-to-speech/${encodeURIComponent(voiceId)}`);
  url.searchParams.set("output_format", DEFAULT_OUTPUT_FORMAT);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": getApiKey(),
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: DEFAULT_MODEL_ID,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      detail ? `ElevenLabs TTS failed (${res.status}): ${detail}` : `ElevenLabs TTS failed (${res.status})`,
    );
  }

  return await res.arrayBuffer();
}

// Simple LRU keyed by text. Queue announcements repeat heavily
// ("Now serving G-001. Please proceed to Counter 1.") so caching here avoids
// hammering ElevenLabs for identical playbacks across reloads / screens.
const audioCache = new Map<string, ArrayBuffer>();
const inflight = new Map<string, Promise<ArrayBuffer>>();
const MAX_CACHE_ENTRIES = 200;

export async function getCachedAnnouncement(
  text: string,
  voice: AnnouncementVoice = "primary",
): Promise<ArrayBuffer> {
  const key = text;

  const cached = audioCache.get(key);
  if (cached) {
    audioCache.delete(key);
    audioCache.set(key, cached);
    return cached;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const buf = await synthesizeAnnouncement(text);
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
