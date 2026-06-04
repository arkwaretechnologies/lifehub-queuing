import { resolveDisplayCounterId } from "@/queue/ticketRouting";
import type { QueueTicket } from "@/queue/types";

/** Format queue display so TTS reads digits individually ("R-L005" → "R-L 0 0 5"). */
export function formatQueueForSpeech(display: string): string {
  return display.replace(/\d{2,}/g, (match) => match.split("").join(" "));
}

export function buildAnnouncementText(
  ticket: Pick<QueueTicket, "queue_display" | "counter_id" | "includes_lab" | "includes_imaging" | "notes">,
  counterLabelById: Map<string, string>,
  labCounterId: string | null,
  imagingCounterId: string | null,
): string {
  const displayCounterId = resolveDisplayCounterId(ticket, labCounterId, imagingCounterId);
  const counterLabel = counterLabelById.get(displayCounterId) ?? "the counter";
  const spokenQueue = formatQueueForSpeech(ticket.queue_display);
  return `Now serving ${spokenQueue}. Please proceed to ${counterLabel}.`;
}

export function announcementUrlForText(text: string, voice?: string): string {
  const params = new URLSearchParams({ text: text.trim() });
  if (voice) params.set("voice", voice);
  return `/api/tts/announce?${params.toString()}`;
}

/** Fixed phrases warmed on TV mount to reduce first-request API cold start. */
export const WARM_ANNOUNCEMENT_PHRASES = [
  "Please proceed to Reception.",
  "Now serving. Please proceed to the counter.",
] as const;
