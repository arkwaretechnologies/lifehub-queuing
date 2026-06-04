import type { QueueStatus } from "@/queue/types";

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

export function isRecallableQueueStatus(status: QueueStatus): boolean {
  return RECALLABLE_QUEUE_STATUSES.includes(status);
}

export function shouldAnnounceOnCalledAtChange(status: QueueStatus): boolean {
  return ANNOUNCE_ON_CALLED_AT_STATUSES.includes(status);
}
