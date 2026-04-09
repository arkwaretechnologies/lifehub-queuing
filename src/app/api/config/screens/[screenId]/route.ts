import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ screenId: string }> },
) {
  const { screenId } = await params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("queue_screens")
    .select("*")
    .eq("screen_id", screenId)
    .maybeSingle();
  if (error) return new NextResponse(error.message, { status: 500 });
  if (!data) return new NextResponse("Screen not found", { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ screenId: string }> },
) {
  const { screenId } = await params;
  const body = await req.json();

  const allowed: Record<string, true> = {
    name: true,
    counter_codes: true,
    playlist_id: true,
    is_active: true,
    entrance_counter_code: true,
    entrance_regular_priority_code: true,
    entrance_priority_priority_code: true,
  };

  const updates: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body)) {
    if (allowed[key]) updates[key] = val;
  }

  if (Object.keys(updates).length === 0) {
    return new NextResponse("No valid fields to update", { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("queue_screens")
    .update(updates)
    .eq("screen_id", screenId)
    .select("*")
    .maybeSingle();

  if (error) return new NextResponse(error.message, { status: 500 });
  if (!data) return new NextResponse("Screen not found", { status: 404 });
  return NextResponse.json(data);
}
