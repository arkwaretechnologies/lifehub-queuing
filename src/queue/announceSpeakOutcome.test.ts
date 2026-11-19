import { describe, expect, it } from "vitest";
import { shouldCommitAnnouncementSnapshot } from "@/queue/announceSpeakOutcome";

describe("shouldCommitAnnouncementSnapshot", () => {
  it("commits only after playback started", () => {
    expect(shouldCommitAnnouncementSnapshot("played")).toBe(true);
    expect(shouldCommitAnnouncementSnapshot("queued_unlock")).toBe(false);
    expect(shouldCommitAnnouncementSnapshot("skipped")).toBe(false);
  });
});