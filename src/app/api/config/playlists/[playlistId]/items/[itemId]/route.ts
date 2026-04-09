import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";

type Ctx = { params: Promise<{ playlistId: string; itemId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { playlistId, itemId } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.src !== undefined) updates.src = body.src;
  if (body.type !== undefined) updates.type = body.type;
  if (body.duration_seconds !== undefined) updates.duration_seconds = body.duration_seconds;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

  if (Object.keys(updates).length === 0) {
    return new NextResponse("No valid fields", { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("media_playlist_items")
    .update(updates)
    .eq("id", itemId)
    .eq("playlist_id", playlistId)
    .select("*")
    .maybeSingle();
  if (error) return new NextResponse(error.message, { status: 500 });
  if (!data) return new NextResponse("Item not found", { status: 404 });

  await supabase
    .from("media_playlists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", playlistId);

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { playlistId, itemId } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase
    .from("media_playlist_items")
    .delete()
    .eq("id", itemId)
    .eq("playlist_id", playlistId);
  if (error) return new NextResponse(error.message, { status: 500 });

  await supabase
    .from("media_playlists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", playlistId);

  return new NextResponse(null, { status: 204 });
}
