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
export type TicketNeedsAnnouncementOptions = {
  fromRealtime?: boolean;
  /**
   * Poll backup: ticket appeared on this TV after load with no prior snapshot
   * (not in initial seed). Safe to announce first sight when `called_at` is set.
   */
  pollFirstSight?: boolean;
};

export function ticketNeedsAnnouncement(
  ticket: Pick<QueueTicket, "called_at" | "status" | "notes">,
  prev: TicketSnapshot | undefined,
  options?: TicketNeedsAnnouncementOptions,
): boolean {
  if (!shouldAnnounceOnCalledAtChange(ticket.status)) return false;

  const activeDept = snapshotActiveDept(ticket.notes);

  if (!prev) {
    if (options?.fromRealtime && ticket.status === "Called") return true;
    if (
      options?.pollFirstSight &&
      ticket.called_at &&
      shouldAnnounceOnCalledAtChange(ticket.status)
    ) {
      return true;
    }
    return false;
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

function sortTicketsForAnnounce(tickets: QueueTicket[]): QueueTicket[] {
  return tickets.slice().sort((a, b) => {
    const aKey = a.called_at ?? a.issued_at;
    const bKey = b.called_at ?? b.issued_at;
    return String(bKey).localeCompare(String(aKey));
  });
}

export type PickTicketsToAnnounceOptions = {
  /** Use poll first-sight rule for tickets missing from snapshot (not initial load). */
  fromPoll?: boolean;
  /** Ticket ids snapshotted on page load — skip poll first-sight for these without a prev row. */
  seededAtLoadIds?: Set<string>;
};

/** Newest `called_at` first (recall / latest call). */
export function pickTicketsToAnnounce(
  tickets: QueueTicket[],
  snapshot: Map<string, TicketSnapshot>,
  options?: PickTicketsToAnnounceOptions,
): QueueTicket[] {
  const candidates = tickets.filter((t) => {
    const prev = snapshot.get(t.id);
    const pollFirstSight =
      Boolean(options?.fromPoll) &&
      !prev &&
      (!options?.seededAtLoadIds || !options.seededAtLoadIds.has(t.id));
    return ticketNeedsAnnouncement(t, prev, { pollFirstSight, fromRealtime: false });
  });
  return sortTicketsForAnnounce(candidates);
}

/** Among tickets that need announcing, prefer the one with the newest `called_at` (recall target). */
export function pickTicketToAnnounce(
  tickets: QueueTicket[],
  snapshot: Map<string, TicketSnapshot>,
  options?: PickTicketsToAnnounceOptions,
): QueueTicket | null {
  const list = pickTicketsToAnnounce(tickets, snapshot, options);
  return list[0] ?? null;
}

export function announcementSpeakKey(
  ticketId: string,
  calledAt: string | null | undefined,
  activeDept: ActiveDeptSnap,
): string {
  return `${ticketId}:${calledAt ?? ""}:${activeDept ?? ""}`;
}