import { NextResponse } from "next/server";
import { supabaseServer } from "@/db/supabaseServer";
import { issueQueueTicket } from "@/queue/issueTicket";

type Body = {
  counterCode?: string;
  priorityCode?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const counterCode = (body.counterCode || "").trim();
  const priorityCode = (body.priorityCode || "").trim();

  if (!counterCode || !priorityCode) {
    return new NextResponse("Missing counterCode or priorityCode", { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc("issue_queue_ticket", {
    p_counter_code: counterCode,
    p_priority_code: priorityCode,
    p_registration_type: "Walk-in",
  });

  if (error) {
    try {
      const ticket = await issueQueueTicket({
        counterCode,
        priorityCode,
        registrationType: "Walk-in",
        displayMode: "priority",
      });
      return NextResponse.json(ticket);
    } catch (fallbackError) {
      const message =
        fallbackError instanceof Error ? fallbackError.message : "Unknown fallback ticket issue error";
      return new NextResponse(
        `Ticket issue failed. Ensure RPC 'issue_queue_ticket' exists. ${error.message}. Fallback issue also failed: ${message}`,
        { status: 500 },
      );
    }
  }

  const ticket = Array.isArray(data) ? data[0] : data;
  return NextResponse.json(ticket);
}

