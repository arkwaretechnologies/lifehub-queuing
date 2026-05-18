import type { SupabaseClient } from "@supabase/supabase-js";

function isYesCollected(v: unknown): boolean {
  return String(v ?? "").trim().toUpperCase() === "Y";
}

/** LifeHub: specimen line on queue ticket notes. */
export function isSpecimenCollectedOnTicket(notes: string | null | undefined): boolean {
  return /^\[Specimen\]\s+collected_at=.+/m.test(notes ?? "");
}

function isImagingItemCaptured(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim();
  return s === "Captured" || s === "Received" || s === "Completed";
}

/** `lab_request_id` values whose billable/entry lines are all marked collected. */
export async function labRequestIdsWithAllSpecimensCollected(
  supabase: SupabaseClient,
  labRequestIds: string[],
): Promise<{ ids: Set<string>; error: string | null }> {
  const unique = [...new Set(labRequestIds.map((x) => String(x).trim()).filter(Boolean))];
  const ids = new Set<string>();
  if (unique.length === 0) return { ids, error: null };

  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80);
    const { data, error } = await supabase
      .from("lab_request_items")
      .select("lab_request_id, collected_item")
      .in("lab_request_id", chunk);
    if (error) return { ids: new Set(), error: error.message };

    const byRequest = new Map<string, Array<{ collected_item?: string | null }>>();
    for (const row of (data ?? []) as Array<{ lab_request_id?: string; collected_item?: string | null }>) {
      const rid = String(row.lab_request_id ?? "").trim();
      if (!rid) continue;
      const list = byRequest.get(rid) ?? [];
      list.push(row);
      byRequest.set(rid, list);
    }

    for (const rid of chunk) {
      const items = byRequest.get(rid) ?? [];
      if (items.length > 0 && items.every((r) => isYesCollected(r.collected_item))) {
        ids.add(rid);
      }
    }
  }

  return { ids, error: null };
}

/** `imaging_request_id` values whose studies are all captured (or beyond). */
export async function imagingRequestIdsWithAllStudiesCaptured(
  supabase: SupabaseClient,
  imagingRequestIds: string[],
): Promise<{ ids: Set<string>; error: string | null }> {
  const unique = [...new Set(imagingRequestIds.map((x) => String(x).trim()).filter(Boolean))];
  const ids = new Set<string>();
  if (unique.length === 0) return { ids, error: null };

  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80);
    const { data, error } = await supabase
      .from("imaging_request_items")
      .select("imaging_request_id, status")
      .in("imaging_request_id", chunk);
    if (error) return { ids: new Set(), error: error.message };

    const byRequest = new Map<string, Array<{ status?: string | null }>>();
    for (const row of (data ?? []) as Array<{ imaging_request_id?: string; status?: string | null }>) {
      const rid = String(row.imaging_request_id ?? "").trim();
      if (!rid) continue;
      const list = byRequest.get(rid) ?? [];
      list.push(row);
      byRequest.set(rid, list);
    }

    for (const rid of chunk) {
      const items = byRequest.get(rid) ?? [];
      if (items.length > 0 && items.every((r) => isImagingItemCaptured(r.status))) {
        ids.add(rid);
      }
    }
  }

  return { ids, error: null };
}

export async function fetchDiagnosticQueueProgress(
  supabase: SupabaseClient,
  labRequestIds: string[],
  imagingRequestIds: string[],
): Promise<{
  labCollectedIds: string[];
  imagingCapturedIds: string[];
  error: string | null;
}> {
  const [labRes, imgRes] = await Promise.all([
    labRequestIdsWithAllSpecimensCollected(supabase, labRequestIds),
    imagingRequestIdsWithAllStudiesCaptured(supabase, imagingRequestIds),
  ]);
  if (labRes.error) return { labCollectedIds: [], imagingCapturedIds: [], error: labRes.error };
  if (imgRes.error) return { labCollectedIds: [], imagingCapturedIds: [], error: imgRes.error };
  return {
    labCollectedIds: [...labRes.ids],
    imagingCapturedIds: [...imgRes.ids],
    error: null,
  };
}
