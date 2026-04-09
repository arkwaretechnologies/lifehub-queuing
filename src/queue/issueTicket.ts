"use server";

import { supabaseServer } from "@/db/supabaseServer";

type QueueCounterRow = {
  id: string;
  code: string;
  name?: string | null;
  prefix?: string | null;
};

type QueuePriorityRow = {
  id: number;
  code: string;
  name?: string | null;
};

type QueueSessionRow = {
  id: string;
  last_number: number | null;
};

export type IssuedQueueTicket = {
  id: string;
  counter_id: string;
  priority_id: number;
  queue_number: number;
  queue_display: string;
  ticket_date: string;
  status: string;
  issued_at: string;
};

type IssueQueueTicketParams = {
  counterCode: string;
  priorityCode: string;
  registrationType: string;
  displayMode: "priority" | "counter";
};

function getPriorityPrefix(priority: QueuePriorityRow): string {
  const code = priority.code.trim().toUpperCase();
  const name = (priority.name ?? "").trim().toUpperCase();

  if (code.startsWith("REG") || name.includes("REGULAR")) return "R";
  if (code.startsWith("PRI") || name.includes("PRIORITY")) return "P";

  return code.slice(0, 1) || "Q";
}

function getCounterPrefix(counter: QueueCounterRow): string {
  const configuredPrefix = (counter.prefix ?? "").trim().toUpperCase();
  if (configuredPrefix) return configuredPrefix;

  const code = counter.code.trim().toUpperCase();
  if (code) return code;

  const name = (counter.name ?? "").trim().toUpperCase();
  if (name) {
    const compact = name.replace(/[^A-Z0-9]+/g, " ").trim();
    const initials = compact
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 4);
    if (initials) return initials;
  }

  return "Q";
}

export async function issueQueueTicket({
  counterCode,
  priorityCode,
  registrationType,
  displayMode,
}: IssueQueueTicketParams): Promise<IssuedQueueTicket> {
  const supabase = supabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: counter, error: counterError }, { data: priority, error: priorityError }] =
    await Promise.all([
      supabase
        .from("queue_counters")
        .select("id, code, name, prefix")
        .eq("code", counterCode)
        .eq("is_active", true)
        .maybeSingle<QueueCounterRow>(),
      supabase
        .from("queue_priorities")
        .select("id, code, name")
        .eq("code", priorityCode)
        .eq("is_active", true)
        .maybeSingle<QueuePriorityRow>(),
    ]);

  if (counterError) throw new Error(counterError.message);
  if (priorityError) throw new Error(priorityError.message);
  if (!counter) throw new Error(`Unknown counterCode: ${counterCode}`);
  if (!priority) throw new Error(`Unknown priorityCode: ${priorityCode}`);

  let session: QueueSessionRow | null = null;
  const { data: existingSession, error: sessionLookupError } = await supabase
    .from("queue_sessions")
    .select("id, last_number")
    .eq("counter_id", counter.id)
    .eq("session_date", today)
    .maybeSingle<QueueSessionRow>();
  if (sessionLookupError) throw new Error(sessionLookupError.message);
  session = existingSession;

  if (!session) {
    const openedAt = new Date().toISOString();
    const { data: createdSession, error: createSessionError } = await supabase
      .from("queue_sessions")
      .insert({
        counter_id: counter.id,
        session_date: today,
        opened_at: openedAt,
        status: "Open",
        last_number: 0,
      })
      .select("id, last_number")
      .single<QueueSessionRow>();

    if (createSessionError) {
      const { data: retrySession, error: retrySessionError } = await supabase
        .from("queue_sessions")
        .select("id, last_number")
        .eq("counter_id", counter.id)
        .eq("session_date", today)
        .maybeSingle<QueueSessionRow>();
      if (retrySessionError) throw new Error(retrySessionError.message);
      if (!retrySession) throw new Error(createSessionError.message);
      session = retrySession;
    } else {
      session = createdSession;
    }
  }

  const { data: lastIssuedTicket, error: lastTicketError } = await supabase
    .from("queue_tickets")
    .select("queue_number")
    .eq("queue_session_id", session.id)
    .eq("counter_id", counter.id)
    .eq("ticket_date", today)
    .order("queue_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ queue_number: number }>();
  if (lastTicketError) throw new Error(lastTicketError.message);

  const displayCountQuery =
    displayMode === "priority"
      ? supabase
          .from("queue_tickets")
          .select("*", { count: "exact", head: true })
          .eq("counter_id", counter.id)
          .eq("priority_id", priority.id)
          .eq("ticket_date", today)
      : supabase
          .from("queue_tickets")
          .select("*", { count: "exact", head: true })
          .eq("counter_id", counter.id)
          .eq("ticket_date", today);

  const { count: displayCount, error: displayCountError } = await displayCountQuery;
  if (displayCountError) throw new Error(displayCountError.message);

  const nextNumber = (lastIssuedTicket?.queue_number ?? 0) + 1;
  const displayNumber = (displayCount ?? 0) + 1;
  const issuedAt = new Date().toISOString();
  const displayPrefix = displayMode === "priority" ? getPriorityPrefix(priority) : getCounterPrefix(counter);

  const { error: updateSessionError } = await supabase
    .from("queue_sessions")
    .update({ last_number: nextNumber, updated_at: issuedAt })
    .eq("id", session.id);
  if (updateSessionError) throw new Error(updateSessionError.message);

  const { data: ticket, error: ticketError } = await supabase
    .from("queue_tickets")
    .insert({
      queue_session_id: session.id,
      counter_id: counter.id,
      priority_id: priority.id,
      queue_number: nextNumber,
      queue_display: `${displayPrefix} - ${String(displayNumber).padStart(3, "0")}`,
      ticket_date: today,
      registration_type: registrationType,
      status: "Waiting",
      issued_at: issuedAt,
    })
    .select("id, counter_id, priority_id, queue_number, queue_display, ticket_date, status, issued_at")
    .single<IssuedQueueTicket>();

  if (ticketError) throw new Error(ticketError.message);
  return ticket;
}
