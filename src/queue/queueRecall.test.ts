import { describe, expect, it } from "vitest";
import {
  announcementSpeakKey,
  ticketNeedsAnnouncement,
  ticketSnapshotFromTicket,
} from "@/queue/queueRecall";

const CALLED_AT = "2026-03-30T10:00:00.000Z";
const CALLED_AT_2 = "2026-03-30T10:01:00.000Z";

describe("ticketNeedsAnnouncement", () => {
  it("announces when active dept changes LAB to IMAG with same called_at", () => {
    const prev = ticketSnapshotFromTicket({
      status: "Called",
      called_at: CALLED_AT,
      notes: "[Active] dept=LAB",
    });
    const next = {
      status: "Called" as const,
      called_at: CALLED_AT,
      notes: "[Active] dept=IMAG",
    };
    expect(ticketNeedsAnnouncement(next, prev, { fromRealtime: true })).toBe(true);
  });

  it("announces when called_at changes", () => {
    const prev = ticketSnapshotFromTicket({
      status: "Called",
      called_at: CALLED_AT,
      notes: "[Active] dept=IMAG",
    });
    const next = {
      status: "Called" as const,
      called_at: CALLED_AT_2,
      notes: "[Active] dept=IMAG",
    };
    expect(ticketNeedsAnnouncement(next, prev)).toBe(true);
  });

  it("does not repeat when neither dept nor called_at changed", () => {
    const notes = "[Active] dept=IMAG";
    const prev = ticketSnapshotFromTicket({ status: "Called", called_at: CALLED_AT, notes });
    const next = { status: "Called" as const, called_at: CALLED_AT, notes };
    expect(ticketNeedsAnnouncement(next, prev)).toBe(false);
  });
});

describe("announcementSpeakKey", () => {
  it("includes active dept", () => {
    expect(announcementSpeakKey("t1", CALLED_AT, "IMAG")).toBe(`t1:${CALLED_AT}:IMAG`);
    expect(announcementSpeakKey("t1", CALLED_AT, "LAB")).not.toBe(announcementSpeakKey("t1", CALLED_AT, "IMAG"));
  });
});