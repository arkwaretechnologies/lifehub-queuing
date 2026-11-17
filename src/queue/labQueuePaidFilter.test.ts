import { describe, expect, it } from "vitest";
import {
  filterTicketsForLaboratoryPaidDisplay,
  isLaboratoryTicketVisibleOnQueue,
  labVisitTicketVisibleOnTv,
} from "@/queue/labQueuePaidFilter";

const LAB_COUNTER = "lab-counter-1";
const REQ = "req-abc";
const paid = new Set<string>();

describe("labVisitTicketVisibleOnTv", () => {
  it("shows tickets without lab_request_id", () => {
    expect(labVisitTicketVisibleOnTv({ lab_request_id: null, status: "Waiting" }, paid)).toBe(true);
  });

  it("hides unpaid visit-linked tickets while Waiting", () => {
    expect(labVisitTicketVisibleOnTv({ lab_request_id: REQ, status: "Waiting" }, paid)).toBe(false);
  });

  it("shows unpaid visit-linked tickets when Called", () => {
    expect(labVisitTicketVisibleOnTv({ lab_request_id: REQ, status: "Called" }, paid)).toBe(true);
  });

  it("shows paid visit-linked tickets while Waiting", () => {
    const paidSet = new Set([REQ]);
    expect(labVisitTicketVisibleOnTv({ lab_request_id: REQ, status: "Waiting" }, paidSet)).toBe(true);
  });
});

describe("isLaboratoryTicketVisibleOnQueue", () => {
  const base = { counter_id: LAB_COUNTER, lab_request_id: REQ };

  it("passes through non-lab counters", () => {
    expect(isLaboratoryTicketVisibleOnQueue({ ...base, counter_id: "reception" }, LAB_COUNTER, paid)).toBe(
      true,
    );
  });

  it("unpaid Waiting on LAB counter is hidden", () => {
    expect(isLaboratoryTicketVisibleOnQueue({ ...base, status: "Waiting" }, LAB_COUNTER, paid)).toBe(false);
  });

  it("unpaid Called on LAB counter is visible", () => {
    expect(isLaboratoryTicketVisibleOnQueue({ ...base, status: "Called" }, LAB_COUNTER, paid)).toBe(true);
  });
});

describe("filterTicketsForLaboratoryPaidDisplay", () => {
  const labWaiting = {
    counter_id: LAB_COUNTER,
    lab_request_id: REQ,
    status: "Waiting",
  };
  const labCalled = { ...labWaiting, status: "Called" };

  it("filters unpaid Waiting when paid ids are loaded", () => {
    const rows = filterTicketsForLaboratoryPaidDisplay([labWaiting, labCalled], LAB_COUNTER, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("Called");
  });
});