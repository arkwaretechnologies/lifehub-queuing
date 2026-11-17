import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { QueueVoiceSettings } from "@/config/types";
import { adminSessionCookieName, readAdminSessionFromRequestCookie } from "@/admin/session";
import { DEFAULT_PIPER_VOICE_CHOICE, isPiperVoiceChoice } from "@/queue/piperVoices";
import { supabaseServer } from "@/db/supabaseServer";

const SETTINGS_ID = "default";

const DEFAULTS: QueueVoiceSettings = {
  id: SETTINGS_ID,
  piper_voice: DEFAULT_PIPER_VOICE_CHOICE,
  updated_at: new Date().toISOString(),
};

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("queue_voice_settings")
    .select("id, piper_voice, updated_at")
    .eq("id", SETTINGS_ID)
    .maybeSingle<QueueVoiceSettings>();

  if (error) {
    if (error.message.includes("schema cache") || error.message.includes("queue_voice_settings")) {
      return NextResponse.json(DEFAULTS);
    }
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json({ ...DEFAULTS, ...(data ?? {}) });
}

export async function PATCH(req: NextRequest) {
  const jar = await cookies();
  const session = readAdminSessionFromRequestCookie(jar.get(adminSessionCookieName)?.value);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as { piper_voice?: string };
  if (!isPiperVoiceChoice(body.piper_voice)) {
    return new NextResponse("Invalid piper_voice", { status: 400 });
  }

  const updates: QueueVoiceSettings = {
    ...DEFAULTS,
    piper_voice: body.piper_voice,
    updated_at: new Date().toISOString(),
  };

  const supabase = supabaseServer();

  const { data: existing } = await supabase
    .from("queue_voice_settings")
    .select("id")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  const result = existing
    ? await supabase
        .from("queue_voice_settings")
        .update({ piper_voice: updates.piper_voice, updated_at: updates.updated_at })
        .eq("id", SETTINGS_ID)
        .select("id, piper_voice, updated_at")
        .single()
    : await supabase
        .from("queue_voice_settings")
        .insert(updates)
        .select("id, piper_voice, updated_at")
        .single();

  if (result.error) {
    return new NextResponse(result.error.message, { status: 500 });
  }

  return NextResponse.json(result.data);
}