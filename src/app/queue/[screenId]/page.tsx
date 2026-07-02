import { QueueScreenClient } from "@/app/queue/[screenId]/QueueScreenClient";
import type { QueueScreen } from "@/config/types";
import { supabaseServer } from "@/db/supabaseServer";
import { resolveLaboratoryCounterCode } from "@/queue/displayCounters";
import { filterLaboratoryTicketsForPaidDisplay } from "@/queue/labQueuePaidFilter";
import { formatTicketDateForQueue } from "@/queue/ticketDate";
import type { QueueTicket } from "@/queue/types";

type Counter = { id: string; code: string; name: string; description: string | null };
type Priority = { id: number; code: string; name: string; level: number };

export default async function QueueScreenPage({ params }: { params: Promise<{ screenId: string }> }) {
  const { screenId } = await params;
  const supabase = supabaseServer();

  const { data: screen } = await supabase
    .from("queue_screens")
    .select("*")
    .eq("screen_id", screenId)
    .maybeSingle<QueueScreen>();

  const { data: countersRaw } = await supabase
    .from("queue_counters")
    .select("id, code, name, description")
    .eq("is_active", true);

  const counters = (countersRaw ?? []).map((c) => ({ ...c, id: String(c.id) })) as Counter[];

  const { data: prioritiesRaw } = await supabase
    .from("queue_priorities")
    .select("id, code, name, level")
    .eq("is_active", true);
  const priorities = (prioritiesRaw ?? []) as Priority[];

  const counterIds = counters.map((c) => c.id);
  const labCode = resolveLaboratoryCounterCode(screen ?? null, counters);
  const labCounterId = labCode
    ? (counters.find((c) => c.code.toUpperCase() === labCode.toUpperCase())?.id ?? null)
    : null;

  const ticketDate = formatTicketDateForQueue(new Date());
  const { data: ticketsRaw, error: ticketsError } = await supabase
    .from("queue_tickets")
    .select(
      "id,counter_id,priority_id,queue_number,queue_display,ticket_date,status,issued_at,called_at,serving_at,completed_at,lab_request_id,includes_lab,includes_imaging,notes",
    )
    .in("counter_id", counterIds.length ? counterIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("ticket_date", ticketDate)
    .in("status", ["Waiting", "Called", "Serving", "Completed", "Collected", "Captured"]);

  if (ticketsError) throw new Error(ticketsError.message);

  const mappedTickets = (ticketsRaw ?? []).map((t) => ({
    ...(t as QueueTicket),
    id: String((t as QueueTicket).id),
    counter_id: String((t as QueueTicket).counter_id),
  })) as QueueTicket[];

  const { rows: initialTickets, error: labFilterError } = await filterLaboratoryTicketsForPaidDisplay(
    supabase,
    mappedTickets,
    labCounterId,
  );
  if (labFilterError) throw new Error(labFilterError);

  const initialPaidLabRequestIds = [
    ...new Set(
      initialTickets
        .filter((t) => labCounterId && t.counter_id === labCounterId)
        .map((t) => String(t.lab_request_id ?? "").trim())
        .filter(Boolean),
    ),
  ];

  return (
    <QueueScreenClient
      screenId={screenId}
      screen={screen ?? null}
      counters={counters}
      priorities={priorities}
      initialTickets={initialTickets}
      initialPaidLabRequestIds={initialPaidLabRequestIds}
    />
  );
}
