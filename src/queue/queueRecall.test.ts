import { describe, expect, it } from "vitest";
import type { QueueTicket } from "@/queue/types";
import {
  announcementSpeakKey,
  calledAtTimestampChanged,
  pickTicketsToAnnounce,
  ticketNeedsAnnouncement,
  ticketSnapshotFromTicket,
} from "@/queue/queueRecall";

const CALLED_AT = "2026-03-30T10:00:00.000Z";
const CALLED_AT_2 = "2026-03-30T10:01:00.000Z";

describe("calledAtTimestampChanged", () => {
  it("detects 1ms recall bump", () => {
    expect(calledAtTimestampChanged("2026-03-30T10:00:00.000Z", "2026-03-30T10:00:00.001Z")).toBe(true);
  });
});

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

  it("announces first call Waiting to Called", () => {
    const prev = ticketSnapshotFromTicket({
      status: "Waiting",
      called_at: null,
      notes: null,
    });
    const next = {
      status: "Called" as const,
      called_at: CALLED_AT,
      notes: null,
    };
    expect(ticketNeedsAnnouncement(next, prev)).toBe(true);
  });

  it("announces poll first sight when Called and called_at set", () => {
    const next = {
      status: "Called" as const,
      called_at: CALLED_AT,
      notes: null,
    };
    expect(ticketNeedsAnnouncement(next, undefined, { pollFirstSight: true })).toBe(true);
    expect(ticketNeedsAnnouncement(next, undefined)).toBe(false);
  });

  it("does not poll first sight without called_at", () => {
    const next = {
      status: "Called" as const,
      called_at: null,
      notes: null,
    };
    expect(ticketNeedsAnnouncement(next, undefined, { pollFirstSight: true })).toBe(false);
  });

  it("does not repeat when neither dept nor called_at changed", () => {
    const notes = "[Active] dept=IMAG";
    const prev = ticketSnapshotFromTicket({ status: "Called", called_at: CALLED_AT, notes });
    const next = { status: "Called" as const, called_at: CALLED_AT, notes };
    expect(ticketNeedsAnnouncement(next, prev)).toBe(false);
  });
});

describe("pickTicketsToAnnounce", () => {
  const base = (id: string, display: string, called_at: string | null, status: QueueTicket["status"]) =>
    ({
      id,
      counter_id: "c1",
      priority_id: 1,
      queue_number: 1,
      queue_display: display,
      ticket_date: "2026-03-30",
      status,
      issued_at: "2026-03-30T09:00:00.000Z",
      called_at,
      serving_at: null,
      completed_at: null,
      lab_request_id: null,
      includes_lab: false,
      includes_imaging: false,
      notes: null,
    }) satisfies QueueTicket;

  it("returns multiple candidates newest first", () => {
    const snap = new Map<string, ReturnType<typeof ticketSnapshotFromTicket>>();
    snap.set(
      "p1",
      ticketSnapshotFromTicket({ status: "Called", called_at: CALLED_AT, notes: null }),
    );
    const tickets = [
      base("p1", "P - 001", CALLED_AT, "Called"),
      base("r1", "R - 005", CALLED_AT_2, "Called"),
    ];
    const picked = pickTicketsToAnnounce(tickets, snap, {
      fromPoll: true,
      seededAtLoadIds: new Set(["p1"]),
    });
    expect(picked.map((t) => t.id)).toEqual(["r1"]);
  });
});

describe("announcementSpeakKey", () => {
  it("includes active dept", () => {
    expect(announcementSpeakKey("t1", CALLED_AT, "IMAG")).toBe(`t1:${CALLED_AT}:IMAG`);
    expect(announcementSpeakKey("t1", CALLED_AT, "LAB")).not.toBe(announcementSpeakKey("t1", CALLED_AT, "IMAG"));
  });
});