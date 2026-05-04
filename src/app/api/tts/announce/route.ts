import { NextRequest } from "next/server";
import {
  getCachedAnnouncement,
  isAnnouncementVoice,
  isVoiceConfigured,
  type AnnouncementVoice,
} from "@/queue/announceVoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 300;

export async function GET(req: NextRequest) {
  const text = (req.nextUrl.searchParams.get("text") ?? "").trim();
  const rawVoice = (req.nextUrl.searchParams.get("voice") ?? "").trim().toLowerCase();
  const voice: AnnouncementVoice = isAnnouncementVoice(rawVoice) ? rawVoice : "primary";

  if (!text) {
    return new Response("Missing 'text' query parameter", { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return new Response("Text too long", { status: 413 });
  }

  if (!isVoiceConfigured(voice)) {
    return new Response(`TTS voice '${voice}' is not configured`, { status: 503 });
  }

  try {
    const audio = await getCachedAnnouncement(text, voice);
    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        // Long-lived browser cache: identical announcement text+voice can be
        // replayed (across reloads / screens) without another ElevenLabs call.
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS error";
    return new Response(message, { status: 502 });
  }
}
