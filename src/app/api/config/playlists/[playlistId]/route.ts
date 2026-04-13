import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";

type Ctx = { params: Promise<{ playlistId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { playlistId } = await params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("media_playlists")
    .select("*")
    .eq("id", playlistId)
    .maybeSingle();
  if (error) return new NextResponse(error.message, { status: 500 });
  if (!data) return new NextResponse("Playlist not found", { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { playlistId } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.loop !== undefined) updates.loop = body.loop;
  if (body.is_default !== undefined) updates.is_default = !!body.is_default;
  if (Object.keys(updates).length === 0) {
    return new NextResponse("No valid fields", { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const supabase = supabaseServer();

  // If setting as default, unset others first (single default).
  if (updates.is_default === true) {
    const { error: clearError } = await supabase
      .from("media_playlists")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .neq("id", playlistId);
    if (clearError) return new NextResponse(clearError.message, { status: 500 });
  }

  const { data, error } = await supabase
    .from("media_playlists")
    .update(updates)
    .eq("id", playlistId)
    .select("*")
    .maybeSingle();
  if (error) return new NextResponse(error.message, { status: 500 });
  if (!data) return new NextResponse("Playlist not found", { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { playlistId } = await params;
  const supabase = supabaseServer();

  await supabase.from("media_playlist_items").delete().eq("playlist_id", playlistId);

  const { error } = await supabase
    .from("media_playlists")
    .delete()
    .eq("id", playlistId);
  if (error) return new NextResponse(error.message, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
