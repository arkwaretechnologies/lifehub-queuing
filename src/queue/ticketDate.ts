/**
 * Calendar date used to match `queue_tickets.ticket_date`.
 * Prefer `NEXT_PUBLIC_QUEUE_TICKET_DATE_TZ` (e.g. Asia/Manila) so SSR, the browser,
 * and PostgreSQL "today" stay aligned when the app host is not in the clinic timezone.
 */
export function formatTicketDateForQueue(d = new Date(), timeZone?: string | null): string {
  const tz =
    timeZone ??
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_QUEUE_TICKET_DATE_TZ : undefined) ??
    null;
  if (tz) {
    return d.toLocaleDateString("en-CA", { timeZone: tz });
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
