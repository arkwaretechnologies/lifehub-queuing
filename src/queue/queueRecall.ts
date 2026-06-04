import type { QueueStatus, QueueTicket } from "@/queue/types";

/**
 * Matches LifeHub main app (`src/lib/queueRecall.ts`).
 * Recall bumps `queue_tickets.called_at` without changing status so TV boards re-announce.
 */
export const RECALLABLE_QUEUE_STATUSES: QueueStatus[] = ["Called", "Serving", "Collected"];

/** Statuses that may trigger a voice announcement when `called_at` changes. */
export const ANNOUNCE_ON_CALLED_AT_STATUSES: QueueStatus[] = [
  "Called",
  "Serving",
  "Collected",
  "Captured",
];

export type TicketSnapshot = { status: string; called_at: string | null };

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
 * True when LifeHub called the patient or bumped `called_at` for recall.
 * Requires a prior snapshot so the TV does not speak every ticket on first load.
 */
export function ticketNeedsAnnouncement(
  ticket: Pick<QueueTicket, "called_at" | "status">,
  prev: TicketSnapshot | undefined,
  options?: { fromRealtime?: boolean },
): boolean {
  if (!ticket.called_at || !shouldAnnounceOnCalledAtChange(ticket.status)) return false;
  if (!prev) {
    // Realtime INSERT (first call). Skip page-load poll so TVs do not speak every ticket on refresh.
    return Boolean(options?.fromRealtime && ticket.status === "Called");
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
  return candidates.sort((a, b) => String(b.called_at).localeCompare(String(a.called_at)))[0] ?? null;
}

export function announcementSpeakKey(ticketId: string, calledAt: string): string {
  return `${ticketId}:${calledAt}`;
}
