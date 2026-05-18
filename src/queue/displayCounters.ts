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

/** Exact code matches tried for the Imaging TV card (order = preference). */
export const IMAGING_COUNTER_CODE_CANDIDATES = [
  "IMAG",
  "IMAGING",
  "RADIOLOGY",
  "XRAY",
  "X-RAY",
  "RAD",
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

/** Resolve imaging counter (LifeHub default `IMAG` / `NEXT_PUBLIC_RECEPTION_IMAGING_QUEUE_CODE`). */
export function resolveImagingCounterCode(screen: QueueScreen | null, counters: CounterRow[]): string | null {
  const entranceCode = resolveEntranceCounterCode(screen, counters);
  const entranceUpper = entranceCode?.toUpperCase() ?? "";
  const labCode = resolveLaboratoryCounterCode(screen, counters);
  const labUpper = labCode?.toUpperCase() ?? "";

  for (const cand of IMAGING_COUNTER_CODE_CANDIDATES) {
    const hit = counters.find((c) => c.code.toUpperCase() === cand);
    if (hit && hit.code.toUpperCase() !== entranceUpper && hit.code.toUpperCase() !== labUpper) return hit.code;
  }

  const byLabel = counters.find((c) => {
    const codeUpper = c.code.toUpperCase();
    if (codeUpper === entranceUpper || codeUpper === labUpper) return false;
    const n = (c.name ?? "").toUpperCase();
    const d = (c.description ?? "").toUpperCase();
    return (
      n.includes("IMAGING") ||
      d.includes("IMAGING") ||
      n.includes("RADIOLOG") ||
      d.includes("RADIOLOG") ||
      (n.includes("X-RAY") || n.includes("XRAY"))
    );
  });
  return byLabel?.code ?? null;
}

/**
 * Return all "service" counters that are neither entrance, lab, nor imaging.
 * These become dynamic queue cards on the TV screen.
 */
export function resolveServiceCounters(screen: QueueScreen | null, counters: CounterRow[]): CounterRow[] {
  const entranceCode = resolveEntranceCounterCode(screen, counters);
  const labCode = resolveLaboratoryCounterCode(screen, counters);
  const imagingCode = resolveImagingCounterCode(screen, counters);

  const excluded = new Set<string>();
  if (entranceCode) excluded.add(entranceCode.toUpperCase());
  if (labCode) excluded.add(labCode.toUpperCase());
  if (imagingCode) excluded.add(imagingCode.toUpperCase());
  excluded.add("RECEPTION");
  excluded.add("ENTRANCE");
  for (const c of LABORATORY_COUNTER_CODE_CANDIDATES) excluded.add(c);
  for (const c of IMAGING_COUNTER_CODE_CANDIDATES) excluded.add(c);

  return counters.filter((c) => !excluded.has(c.code.toUpperCase()));
}
