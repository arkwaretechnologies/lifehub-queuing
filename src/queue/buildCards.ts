import type { QueueCardModel, QueueTicket } from "@/queue/types";
import { type QueueCardDept, ticketCountsAsNowServingForDept } from "@/queue/queueActiveDept";

function pickNowServing(tickets: QueueTicket[], cardDept?: QueueCardDept) {
  const recentCompletedCutoffMs = Date.now() - 2 * 60 * 1000;
  const isRecentCompleted = (t: QueueTicket) => {
    if (t.status !== "Completed") return false;
    if (!t.completed_at) return false;
    const ms = Date.parse(t.completed_at);
    if (Number.isNaN(ms)) return false;
    return ms >= recentCompletedCutoffMs;
  };

  const active = tickets
    .filter((t) => {
      if (!(t.status === "Serving" || t.status === "Called" || isRecentCompleted(t))) return false;
      if (cardDept) return ticketCountsAsNowServingForDept(t, cardDept);
      return true;
    })
    .sort((a, b) =>
      (b.called_at || b.serving_at || b.completed_at || b.issued_at).localeCompare(
        a.called_at || a.serving_at || a.completed_at || a.issued_at,
      ),
    );
  return active[0] ?? null;
}

function pickNextUp(tickets: QueueTicket[], limit: number) {
  return tickets
    .filter((t) => t.status === "Waiting")
    .sort((a, b) => a.issued_at.localeCompare(b.issued_at))
    .slice(0, limit);
}

export function buildQueueCard({
  title,
  subtitle,
  accent,
  tickets,
  nextLimit = 5,
  cardDept,
}: {
  title: string;
  subtitle?: string;
  accent: QueueCardModel["accent"];
  tickets: QueueTicket[];
  nextLimit?: number;
  /** When set, "now serving" respects shared-ticket active department (LAB vs IMAG). */
  cardDept?: QueueCardDept;
}): QueueCardModel {
  const now = pickNowServing(tickets, cardDept);
  const next = pickNextUp(tickets, nextLimit);
  return {
    title,
    subtitle,
    accent,
    nowServing: now?.queue_display ?? null,
    nextUp: next.map((t) => t.queue_display),
  };
}
