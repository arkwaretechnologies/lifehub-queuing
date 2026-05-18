import type { SupabaseClient } from "@supabase/supabase-js";
import { isSpecimenCollectedOnTicket } from "@/queue/diagnosticQueueProgress";
import type { QueueTicket } from "@/queue/types";

export const LAB_SALES_TABLE = "lab_sales" as const;

export type DiagnosticQueueTicket = QueueTicket & {
  lab_request_id?: string | null;
  imaging_request_id?: string | null;
  includes_lab?: boolean | null;
  includes_imaging?: boolean | null;
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

/** `imaging_request_id` values paid at cashier (`lab_sales.imaging_request_id`). */
export async function imagingRequestIdsWithSales(
  supabase: SupabaseClient,
  imagingRequestIds: string[],
): Promise<{ ids: Set<string>; error: string | null }> {
  const unique = [...new Set(imagingRequestIds.map((x) => String(x).trim()).filter(Boolean))];
  const ids = new Set<string>();
  if (unique.length === 0) return { ids, error: null };

  for (let i = 0; i < unique.length; i += 120) {
    const chunk = unique.slice(i, i + 120);
    const { data, error } = await supabase
      .from(LAB_SALES_TABLE)
      .select("imaging_request_id")
      .in("imaging_request_id", chunk);
    if (error) return { ids: new Set(), error: error.message };
    for (const row of (data ?? []) as Array<{ imaging_request_id?: string | null }>) {
      const id = String(row.imaging_request_id ?? "").trim();
      if (id) ids.add(id);
    }
  }
  return { ids, error: null };
}

/** Matches LifeHub Lab Appointments (`includes_lab`); falls back to LAB counter for legacy rows. */
export function ticketIncludesLaboratory(
  ticket: Pick<DiagnosticQueueTicket, "counter_id" | "includes_lab" | "lab_request_id">,
  laboratoryCounterId: string | null,
): boolean {
  if (ticket.includes_lab === false) return false;
  if (ticket.includes_lab === true) return true;
  if (String(ticket.lab_request_id ?? "").trim()) return true;
  return Boolean(laboratoryCounterId && String(ticket.counter_id) === laboratoryCounterId);
}

/** Matches LifeHub Imaging Appointments (`includes_imaging`); falls back to IMAG counter for legacy rows. */
export function ticketIncludesImaging(
  ticket: Pick<DiagnosticQueueTicket, "counter_id" | "includes_imaging" | "imaging_request_id">,
  imagingCounterId: string | null,
): boolean {
  if (ticket.includes_imaging === false) return false;
  if (ticket.includes_imaging === true) return true;
  if (String(ticket.imaging_request_id ?? "").trim()) return true;
  return Boolean(imagingCounterId && String(ticket.counter_id) === imagingCounterId);
}

function isLabCollectionCompleteForTicket(
  ticket: DiagnosticQueueTicket,
  labCollectedIds: Set<string>,
): boolean {
  if (isSpecimenCollectedOnTicket(ticket.notes)) return true;
  const labId = String(ticket.lab_request_id ?? "").trim();
  return Boolean(labId && labCollectedIds.has(labId));
}

/** Hide from laboratory TV once specimen collection is done (especially when imaging is still pending). */
export function shouldHideFromLaboratoryCard(
  ticket: DiagnosticQueueTicket,
  labCollectedIds: Set<string>,
): boolean {
  if (!isLabCollectionCompleteForTicket(ticket, labCollectedIds)) return false;
  return true;
}

/** Hide from imaging TV once all studies are captured. */
export function shouldHideFromImagingCard(
  ticket: DiagnosticQueueTicket,
  imagingCapturedIds: Set<string>,
): boolean {
  const imgId = String(ticket.imaging_request_id ?? "").trim();
  if (!imgId) return false;
  return imagingCapturedIds.has(imgId);
}

export function isLaboratoryTicketVisibleOnQueue(
  ticket: DiagnosticQueueTicket,
  laboratoryCounterId: string | null,
  paidLabRequestIds: Set<string>,
  labCollectedIds: Set<string> = new Set(),
): boolean {
  if (!ticketIncludesLaboratory(ticket, laboratoryCounterId)) return false;
  if (shouldHideFromLaboratoryCard(ticket, labCollectedIds)) return false;
  const reqId = String(ticket.lab_request_id ?? "").trim();
  if (!reqId) return true;
  return paidLabRequestIds.has(reqId);
}

export function isImagingTicketVisibleOnQueue(
  ticket: DiagnosticQueueTicket,
  imagingCounterId: string | null,
  paidImagingRequestIds: Set<string>,
  imagingCapturedIds: Set<string> = new Set(),
): boolean {
  if (!ticketIncludesImaging(ticket, imagingCounterId)) return false;
  if (shouldHideFromImagingCard(ticket, imagingCapturedIds)) return false;
  const reqId = String(ticket.imaging_request_id ?? "").trim();
  if (!reqId) return true;
  return paidImagingRequestIds.has(reqId);
}

export function ticketsForLaboratoryCard(
  tickets: DiagnosticQueueTicket[],
  laboratoryCounterId: string | null,
  paidLabRequestIds: Set<string> | null,
  labCollectedIds: Set<string> | null = null,
): DiagnosticQueueTicket[] {
  const collected = labCollectedIds ?? new Set<string>();
  if (!paidLabRequestIds) {
    return tickets.filter((t) => {
      if (!ticketIncludesLaboratory(t, laboratoryCounterId)) return false;
      if (shouldHideFromLaboratoryCard(t, collected)) return false;
      return !String(t.lab_request_id ?? "").trim();
    });
  }
  return tickets.filter((t) =>
    isLaboratoryTicketVisibleOnQueue(t, laboratoryCounterId, paidLabRequestIds, collected),
  );
}

export function ticketsForImagingCard(
  tickets: DiagnosticQueueTicket[],
  imagingCounterId: string | null,
  paidImagingRequestIds: Set<string> | null,
  imagingCapturedIds: Set<string> | null = null,
): DiagnosticQueueTicket[] {
  const captured = imagingCapturedIds ?? new Set<string>();
  if (!paidImagingRequestIds) {
    return tickets.filter((t) => {
      if (!ticketIncludesImaging(t, imagingCounterId)) return false;
      if (shouldHideFromImagingCard(t, captured)) return false;
      return !String(t.imaging_request_id ?? "").trim();
    });
  }
  return tickets.filter((t) =>
    isImagingTicketVisibleOnQueue(t, imagingCounterId, paidImagingRequestIds, captured),
  );
}

/** @deprecated Use per-card filters; kept for imports that expect a global lab-only pass. */
export async function filterLaboratoryTicketsForPaidDisplay<
  T extends { counter_id: string; lab_request_id?: string | null },
>(supabase: SupabaseClient, tickets: T[], laboratoryCounterId: string | null): Promise<{ rows: T[]; error: string | null }> {
  if (!laboratoryCounterId) return { rows: tickets, error: null };

  const withReq = tickets.filter(
    (t) => String(t.counter_id) === laboratoryCounterId && String(t.lab_request_id ?? "").trim().length > 0,
  );
  if (withReq.length === 0) return { rows: tickets, error: null };

  const { ids: paidIds, error } = await labRequestIdsWithLabSales(
    supabase,
    withReq.map((t) => String(t.lab_request_id ?? "").trim()),
  );
  if (error) return { rows: [], error };

  return {
    rows: tickets.filter((t) => {
      if (String(t.counter_id) !== laboratoryCounterId) return true;
      const reqId = String(t.lab_request_id ?? "").trim();
      if (!reqId) return true;
      return paidIds.has(reqId);
    }),
    error: null,
  };
}

/** @deprecated Use `ticketsForLaboratoryCard` instead. */
export function filterTicketsForLaboratoryPaidDisplay<
  T extends { counter_id: string; lab_request_id?: string | null },
>(tickets: T[], laboratoryCounterId: string | null, paidLabRequestIds: Set<string> | null): T[] {
  return ticketsForLaboratoryCard(
    tickets as unknown as DiagnosticQueueTicket[],
    laboratoryCounterId,
    paidLabRequestIds,
  ) as unknown as T[];
}
