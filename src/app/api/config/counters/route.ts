import { NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("queue_counters")
    .select("id, code, name, description")
    .order("code");
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data);
}
