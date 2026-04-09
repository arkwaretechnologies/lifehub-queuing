import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase.from("media_playlists").select("*").order("updated_at", {
    ascending: false,
  });
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = body.name?.trim();
  if (!name) return new NextResponse("Name is required", { status: 400 });

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("media_playlists")
    .insert({ name, loop: body.loop ?? true, is_default: false })
    .select("*")
    .single();
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

