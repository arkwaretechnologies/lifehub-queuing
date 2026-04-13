/**
 * Returns an ISO-8601 timestamp string with explicit timezone offset.
 *
 * We store timestamps as timestamptz in Postgres, so an offset string like
 * `2026-04-13T23:10:00+08:00` is unambiguous and corresponds to the same instant as UTC `Z`.
 *
 * Default timezone is Asia/Manila (UTC+08:00).
 */
export function nowIsoWithOffset(timeZone = "Asia/Manila"): string {
  // Asia/Manila has no DST; treat it as fixed +08:00.
  // If a different tz is provided, we still format the local wall time for that tz,
  // but we keep the offset at +08:00 only when using Asia/Manila.
  const tz = timeZone || "Asia/Manila";
  const d = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hh = get("hour");
  const mi = get("minute");
  const ss = get("second");

  // For now, we only support Manila offset explicitly.
  const offset = tz.toLowerCase() === "asia/manila" ? "+08:00" : "Z";
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${offset}`;
}

