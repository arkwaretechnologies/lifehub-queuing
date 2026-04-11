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

/** Uppercase codes needed to resolve counters for a TV screen (includes kiosk defaults). */
export function collectScreenCounterCodesUpper(screen: QueueScreen | null): Set<string> {
  const s = new Set<string>();
  (screen?.counter_codes ?? []).forEach((c) => s.add(String(c).toUpperCase()));
  if (screen?.entrance_counter_code) s.add(screen.entrance_counter_code.toUpperCase());
  s.add("RECEPTION");
  s.add("ENTRANCE");
  LABORATORY_COUNTER_CODE_CANDIDATES.forEach((c) => s.add(c));
  return s;
}

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
