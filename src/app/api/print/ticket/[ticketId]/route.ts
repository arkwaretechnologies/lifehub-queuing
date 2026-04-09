import { NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const { ticketId } = await params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("queue_tickets")
    .select("id, queue_display, issued_at, ticket_date")
    .eq("id", ticketId)
    .maybeSingle();

  if (error) return new NextResponse(error.message, { status: 500 });
  if (!data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(data);
}

