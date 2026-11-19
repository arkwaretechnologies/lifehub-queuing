import { parseActiveDept } from "@/queue/ticketRouting";
import type { QueueStatus, QueueTicket } from "@/queue/types";

/**
 * Must stay in sync with LifeHub `src/lib/queueRecall.ts` (TV announce contract).
 * Recall bumps `queue_tickets.called_at` without changing status so lobby boards re-announce.
 */
export const RECALLABLE_QUEUE_STATUSES: QueueStatus[] = ["Called", "Serving", "Collected"];

/** Statuses that may trigger a voice announcement when `called_at` changes. */
export const ANNOUNCE_ON_CALLED_AT_STATUSES: QueueStatus[] = [
  "Called",
  "Serving",
  "Collected",
  "Captured",
];

export type ActiveDeptSnap = "LAB" | "IMAG" | null;

export type TicketSnapshot = {
  status: string;
  called_at: string | null;
  active_dept: ActiveDeptSnap;
};

export function snapshotActiveDept(notes: string | null | undefined): ActiveDeptSnap {
  return parseActiveDept(notes);
}

export function ticketSnapshotFromTicket(
  ticket: Pick<QueueTicket, "status" | "called_at" | "notes">,
): TicketSnapshot {
  return {
    status: ticket.status,
    called_at: ticket.called_at ?? null,
    active_dept: snapshotActiveDept(ticket.notes),
  };
}

export function isRecallableQueueStatus(status: QueueStatus): boolean {
  return RECALLABLE_QUEUE_STATUSES.includes(status);
}

export function shouldAnnounceOnCalledAtChange(status: QueueStatus): boolean {
  return ANNOUNCE_ON_CALLED_AT_STATUSES.includes(status);
}

/** Compare timestamps even when formatting differs (+00:00 vs Z). */
export function calledAtTimestampChanged(
  prev: string | null | undefined,
  next: string | null | undefined,
): boolean {
  if (prev === next) return false;
  if (!prev || !next) return Boolean(prev) !== Boolean(next);
  const p = Date.parse(prev);
  const n = Date.parse(next);
  if (!Number.isNaN(p) && !Number.isNaN(n)) return p !== n;
  return prev !== next;
}

/**
 * True when LifeHub called the patient, bumped `called_at` for recall, or routed LAB↔IMAG.
 * Requires a prior snapshot so the TV does not speak every ticket on first load.
 */
export function ticketNeedsAnnouncement(
  ticket: Pick<QueueTicket, "called_at" | "status" | "notes">,
  prev: TicketSnapshot | undefined,
  options?: { fromRealtime?: boolean },
): boolean {
  if (!shouldAnnounceOnCalledAtChange(ticket.status)) return false;

  const activeDept = snapshotActiveDept(ticket.notes);

  if (!prev) {
    return Boolean(options?.fromRealtime && ticket.status === "Called");
  }

  if (prev.active_dept !== activeDept) return true;

  if (!ticket.called_at) {
    return (
      !shouldAnnounceOnCalledAtChange(prev.status as QueueStatus) &&
      shouldAnnounceOnCalledAtChange(ticket.status)
    );
  }

  if (calledAtTimestampChanged(prev.called_at, ticket.called_at)) return true;
  return (
    !shouldAnnounceOnCalledAtChange(prev.status as QueueStatus) &&
    shouldAnnounceOnCalledAtChange(ticket.status)
  );
}

/** Among tickets that need announcing, prefer the one with the newest `called_at` (recall target). */
export function pickTicketToAnnounce(
  tickets: QueueTicket[],
  snapshot: Map<string, TicketSnapshot>,
): QueueTicket | null {
  const candidates = tickets.filter((t) => ticketNeedsAnnouncement(t, snapshot.get(t.id)));
  if (!candidates.length) return null;
  return (
    candidates.sort((a, b) => {
      const aKey = a.called_at ?? a.issued_at;
      const bKey = b.called_at ?? b.issued_at;
      return String(bKey).localeCompare(String(aKey));
    })[0] ?? null
  );
}

export function announcementSpeakKey(
  ticketId: string,
  calledAt: string | null | undefined,
  activeDept: ActiveDeptSnap,
): string {
  return `${ticketId}:${calledAt ?? ""}:${activeDept ?? ""}`;
}