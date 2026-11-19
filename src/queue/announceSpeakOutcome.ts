/** Result of attempting to play queue speech on this screen. */
export type SpeakAnnouncementResult = "played" | "queued_unlock" | "skipped";

/** Only advance TV snapshot / speak-key after audio actually started (not when blocked). */
export function shouldCommitAnnouncementSnapshot(result: SpeakAnnouncementResult): boolean {
  return result === "played";
}