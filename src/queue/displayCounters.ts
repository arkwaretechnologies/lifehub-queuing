import type { QueueScreen } from "@/config/types";

export type CounterRow = { id: string; code: string; name: string; description: string | null };

/** Exact code matches tried for the Laboratory TV card (order = preference). */
export const LABORATORY_COUNTER_CODE_CANDIDATES = [
  "LABORATORY",
  "LAB_COLLECTION",
  "LABCOLL",
  "COLLECTION",
  "LAB",
] as const;

/** Same preference order as `src/app/entrance/page.tsx` when screen config is missing. */
export function resolveEntranceCounterCode(screen: QueueScreen | null, counters: CounterRow[]): string | null {
  if (screen?.entrance_counter_code) {
    const hit = counters.find((c) => c.code.toUpperCase() === screen.entrance_counter_code!.toUpperCase());
    if (hit) return hit.code;
  }
  const reception = counters.find((c) => c.code.toUpperCase() === "RECEPTION");
  if (reception) return reception.code;
  const entrance = counters.find((c) => c.code.toUpperCase() === "ENTRANCE");
  return entrance?.code ?? null;
}

/** Same idea as reception: resolve a lab counter even when `counter_codes` omits it. */
export function resolveLaboratoryCounterCode(screen: QueueScreen | null, counters: CounterRow[]): string | null {
  const entranceCode = resolveEntranceCounterCode(screen, counters);
  const entranceUpper = entranceCode?.toUpperCase() ?? "";

  for (const cand of LABORATORY_COUNTER_CODE_CANDIDATES) {
    const hit = counters.find((c) => c.code.toUpperCase() === cand);
    if (hit && hit.code.toUpperCase() !== entranceUpper) return hit.code;
  }

  const byLabel = counters.find((c) => {
    if (c.code.toUpperCase() === entranceUpper) return false;
    const n = (c.name ?? "").toUpperCase();
    const d = (c.description ?? "").toUpperCase();
    return (
      n.includes("LABORAT") ||
      d.includes("LABORAT") ||
      (n.includes("LAB") && !n.includes("LABEL")) ||
      d.includes("COLLECTION")
    );
  });
  return byLabel?.code ?? null;
}

function isImagingCounter(c: CounterRow): boolean {
  const upper = (s: string | null | undefined) => (s ?? "").toUpperCase();
  return (
    upper(c.code).includes("IMAGING") ||
    upper(c.name).includes("IMAGING") ||
    upper(c.description).includes("IMAGING")
  );
}

/** Imaging on the top row with Reception/Lab; remaining service counters below, sorted by name. */
function sortServiceCountersForDisplay(a: CounterRow, b: CounterRow): number {
  const imagingA = isImagingCounter(a) ? 0 : 1;
  const imagingB = isImagingCounter(b) ? 0 : 1;
  if (imagingA !== imagingB) return imagingA - imagingB;
  return (a.name ?? a.code).localeCompare(b.name ?? b.code, undefined, { numeric: true });
}

/**
 * Return all "service" counters that are neither entrance nor lab.
 * These become dynamic queue cards on the TV screen.
 */
export function resolveServiceCounters(screen: QueueScreen | null, counters: CounterRow[]): CounterRow[] {
  const entranceCode = resolveEntranceCounterCode(screen, counters);
  const labCode = resolveLaboratoryCounterCode(screen, counters);

  const excluded = new Set<string>();
  if (entranceCode) excluded.add(entranceCode.toUpperCase());
  if (labCode) excluded.add(labCode.toUpperCase());
  excluded.add("RECEPTION");
  excluded.add("ENTRANCE");
  for (const c of LABORATORY_COUNTER_CODE_CANDIDATES) excluded.add(c);

  const filtered = counters.filter((c) => !excluded.has(c.code.toUpperCase()));
  return filtered.slice().sort(sortServiceCountersForDisplay);
}
