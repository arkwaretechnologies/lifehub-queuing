import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";

type Ctx = { params: Promise<{ playlistId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { playlistId } = await params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("media_playlist_items")
    .select("*")
    .eq("playlist_id", playlistId)
    .order("sort_order", { ascending: true });
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { playlistId } = await params;
  const body = await req.json();

  const type = body.type;
  const src = body.src?.trim();
  if (!type || !src) {
    return new NextResponse("type and src are required", { status: 400 });
  }
  if (type !== "video" && type !== "youtube" && type !== "image") {
    return new NextResponse("type must be 'video', 'youtube', or 'image'", { status: 400 });
  }

  const supabase = supabaseServer();

  const { data: maxRow } = await supabase
    .from("media_playlist_items")
    .select("sort_order")
    .eq("playlist_id", playlistId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("media_playlist_items")
    .insert({
      playlist_id: playlistId,
      type,
      src,
      title: body.title?.trim() || null,
      duration_seconds: body.duration_seconds ?? null,
      sort_order: nextOrder,
    })
    .select("*")
    .single();
  if (error) return new NextResponse(error.message, { status: 500 });

  await supabase
    .from("media_playlists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", playlistId);

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { playlistId } = await params;
  const body = await req.json();

  if (!Array.isArray(body.items)) {
    return new NextResponse("Expected { items: [{ id, sort_order }] }", { status: 400 });
  }

  const supabase = supabaseServer();
  for (const item of body.items) {
    if (!item.id || item.sort_order === undefined) continue;
    await supabase
      .from("media_playlist_items")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id)
      .eq("playlist_id", playlistId);
  }

  await supabase
    .from("media_playlists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", playlistId);

  const { data } = await supabase
    .from("media_playlist_items")
    .select("*")
    .eq("playlist_id", playlistId)
    .order("sort_order", { ascending: true });

  return NextResponse.json(data);
}
