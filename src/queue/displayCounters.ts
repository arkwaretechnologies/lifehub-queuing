import type { QueueScreen } from "@/config/types";

export type CounterRow = { id: string; code: string; name: string; description: string | null };

/** Uppercase codes needed to resolve counters for a TV screen (includes kiosk defaults). */
export function collectScreenCounterCodesUpper(screen: QueueScreen | null): Set<string> {
  const s = new Set<string>();
  (screen?.counter_codes ?? []).forEach((c) => s.add(String(c).toUpperCase()));
  if (screen?.entrance_counter_code) s.add(screen.entrance_counter_code.toUpperCase());
  s.add("RECEPTION");
  s.add("ENTRANCE");
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
