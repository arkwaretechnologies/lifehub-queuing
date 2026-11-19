import type { TicketSnapshot } from "@/queue/queueRecall";

export type TicketAnnounceCommit = {
  ticketId: string;
  speakKey: string;
  text: string;
  snapshot: TicketSnapshot;
};

const queued = new Map<string, TicketAnnounceCommit>();

export function queueTicketAnnouncement(item: TicketAnnounceCommit): void {
  queued.set(item.speakKey, item);
}

export function hasQueuedTicketAnnouncement(speakKey: string): boolean {
  return queued.has(speakKey);
}

export function peekQueuedTicketAnnouncements(): TicketAnnounceCommit[] {
  return [...queued.values()];
}

export function dequeueTicketAnnouncement(speakKey: string): TicketAnnounceCommit | undefined {
  const item = queued.get(speakKey);
  if (item) queued.delete(speakKey);
  return item;
}

export function clearQueuedTicketAnnouncements(): void {
  queued.clear();
}