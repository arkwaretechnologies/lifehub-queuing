import type { QueueCardModel, QueueTicket } from "@/queue/types";

function pickNowServing(tickets: QueueTicket[]) {
  const active = tickets
    .filter((t) => t.status === "Serving" || t.status === "Called")
    .sort((a, b) => (b.called_at || b.serving_at || b.issued_at).localeCompare(a.called_at || a.serving_at || a.issued_at));
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
}: {
  title: string;
  subtitle?: string;
  accent: QueueCardModel["accent"];
  tickets: QueueTicket[];
  nextLimit?: number;
}): QueueCardModel {
  const now = pickNowServing(tickets);
  const next = pickNextUp(tickets, nextLimit);
  return {
    title,
    subtitle,
    accent,
    nowServing: now?.queue_display ?? null,
    nextUp: next.map((t) => t.queue_display),
  };
}

