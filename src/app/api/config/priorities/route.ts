import { NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("queue_priorities")
    .select("id, code, name, level")
    .order("level");
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data);
}
