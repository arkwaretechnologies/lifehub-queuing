import { describe, expect, it } from "vitest";
import {
  clearQueuedTicketAnnouncements,
  dequeueTicketAnnouncement,
  hasQueuedTicketAnnouncement,
  queueTicketAnnouncement,
} from "@/queue/ticketAnnounceQueue";

describe("ticketAnnounceQueue", () => {
  it("queues and dequeues by speak key", () => {
    clearQueuedTicketAnnouncements();
    const item = {
      ticketId: "t1",
      speakKey: "t1:2026-01-01T00:00:00.000Z:",
      text: "Now serving P 0 0 2.",
      snapshot: { status: "Called", called_at: "2026-01-01T00:00:00.000Z", active_dept: null },
    };
    queueTicketAnnouncement(item);
    expect(hasQueuedTicketAnnouncement(item.speakKey)).toBe(true);
    expect(dequeueTicketAnnouncement(item.speakKey)).toEqual(item);
    expect(hasQueuedTicketAnnouncement(item.speakKey)).toBe(false);
  });
});