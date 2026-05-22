import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueueTicket } from "@/queue/types";

export const LAB_SALES_TABLE = "lab_sales" as const;

export type QueueTicketWithLabRequest = QueueTicket & {
  lab_request_id?: string | null;
};

/** `lab_request_id` values that have at least one `lab_sales` row (visible on laboratory queue). */
export async function labRequestIdsWithLabSales(
  supabase: SupabaseClient,
  labRequestIds: string[],
): Promise<{ ids: Set<string>; error: string | null }> {
  const unique = [...new Set(labRequestIds.map((x) => String(x).trim()).filter(Boolean))];
  const ids = new Set<string>();
  if (unique.length === 0) return { ids, error: null };

  for (let i = 0; i < unique.length; i += 120) {
    const chunk = unique.slice(i, i + 120);
    const { data, error } = await supabase.from(LAB_SALES_TABLE).select("lab_request_id").in("lab_request_id", chunk);
    if (error) return { ids: new Set(), error: error.message };
    for (const row of (data ?? []) as Array<{ lab_request_id?: string | null }>) {
      const id = String(row.lab_request_id ?? "").trim();
      if (id) ids.add(id);
    }
  }
  return { ids, error: null };
}

/**
 * Laboratory TV queue: hide LAB tickets for visit-linked lab orders until `lab_sales` exists.
 * Tickets without `lab_request_id` are always shown (same as LifeHub Lab Appointments).
 */
export async function filterLaboratoryTicketsForPaidDisplay<
  T extends { counter_id: string; lab_request_id?: string | null },
>(supabase: SupabaseClient, tickets: T[], laboratoryCounterId: string | null): Promise<{ rows: T[]; error: string | null }> {
  if (!laboratoryCounterId) return { rows: tickets, error: null };

  const labCounterKey = laboratoryCounterId.trim();
  const labTickets = tickets.filter((t) => String(t.counter_id) === labCounterKey);
  const otherTickets = tickets.filter((t) => String(t.counter_id) !== labCounterKey);

  const withReq = labTickets.filter((t) => String(t.lab_request_id ?? "").trim().length > 0);
  const withoutReq = labTickets.filter((t) => !String(t.lab_request_id ?? "").trim());
  if (withReq.length === 0) return { rows: [...otherTickets, ...withoutReq], error: null };

  const { ids: paidIds, error } = await labRequestIdsWithLabSales(
    supabase,
    withReq.map((t) => String(t.lab_request_id ?? "").trim()),
  );
  if (error) return { rows: [], error };

  const visible = withReq.filter((t) => paidIds.has(String(t.lab_request_id ?? "").trim()));
  return { rows: [...otherTickets, ...withoutReq, ...visible], error: null };
}

/** Client-side mirror of `filterLaboratoryTicketsForPaidDisplay` when `paidLabRequestIds` is loaded. */
export function isLaboratoryTicketVisibleOnQueue(
  ticket: { counter_id: string; lab_request_id?: string | null },
  laboratoryCounterId: string | null,
  paidLabRequestIds: Set<string>,
): boolean {
  if (!laboratoryCounterId || String(ticket.counter_id) !== laboratoryCounterId) return true;
  const reqId = String(ticket.lab_request_id ?? "").trim();
  if (!reqId) return true;
  return paidLabRequestIds.has(reqId);
}

export function filterTicketsForLaboratoryPaidDisplay<
  T extends { counter_id: string; lab_request_id?: string | null },
>(tickets: T[], laboratoryCounterId: string | null, paidLabRequestIds: Set<string> | null): T[] {
  if (!laboratoryCounterId) return tickets;
  if (!paidLabRequestIds) {
    return tickets.filter((t) => {
      if (String(t.counter_id) !== laboratoryCounterId) return true;
      return !String(t.lab_request_id ?? "").trim();
    });
  }
  return tickets.filter((t) => isLaboratoryTicketVisibleOnQueue(t, laboratoryCounterId, paidLabRequestIds));
}
