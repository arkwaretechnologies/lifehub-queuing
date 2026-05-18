/** Which department currently holds the patient on a shared lab+imaging ticket (LifeHub). */
export type QueueActiveDept = "LAB" | "IMAG" | null;

const ACTIVE_DEPT_RE = /^\[Active\]\s+dept=(LAB|IMAG)\s*$/im;

export function parseActiveDeptFromNotes(notes: string | null | undefined): QueueActiveDept {
  const m = String(notes ?? "").match(ACTIVE_DEPT_RE);
  if (!m) return null;
  const dept = m[1]?.toUpperCase();
  return dept === "LAB" || dept === "IMAG" ? dept : null;
}

export type QueueCardDept = "LAB" | "IMAG";

/** Whether a shared diagnostic ticket should show as "now serving" on a given TV card. */
export function ticketCountsAsNowServingForDept(
  ticket: {
    includes_lab?: boolean | null;
    includes_imaging?: boolean | null;
    lab_request_id?: string | null;
    imaging_request_id?: string | null;
    notes?: string | null;
  },
  dept: QueueCardDept,
): boolean {
  const hasLab =
    ticket.includes_lab === true || Boolean(String(ticket.lab_request_id ?? "").trim());
  const hasImaging =
    ticket.includes_imaging === true || Boolean(String(ticket.imaging_request_id ?? "").trim());
  const active = parseActiveDeptFromNotes(ticket.notes);

  if (hasLab && hasImaging) {
    if (active === "LAB") return dept === "LAB";
    if (active === "IMAG") return dept === "IMAG";
    return false;
  }
  if (dept === "LAB") return hasLab;
  if (dept === "IMAG") return hasImaging;
  return false;
}

/** Voice prompt destination: use active dept / includes_* flags, not raw counter_id (shared tickets sit on LAB). */
export function resolveQueueAnnouncementDestination(
  ticket: {
    counter_id: string;
    includes_lab?: boolean | null;
    includes_imaging?: boolean | null;
    lab_request_id?: string | null;
    imaging_request_id?: string | null;
    notes?: string | null;
  },
  opts: {
    counterLabelById: Map<string, string>;
    laboratoryLabel?: string | null;
    imagingLabel?: string | null;
  },
): string {
  const active = parseActiveDeptFromNotes(ticket.notes);
  const hasLab =
    ticket.includes_lab === true || Boolean(String(ticket.lab_request_id ?? "").trim());
  const hasImaging =
    ticket.includes_imaging === true || Boolean(String(ticket.imaging_request_id ?? "").trim());
  const labName = (opts.laboratoryLabel ?? "").trim() || "Laboratory";
  const imgName = (opts.imagingLabel ?? "").trim() || "Imaging";

  if (active === "IMAG") return imgName;
  if (active === "LAB") return labName;
  if (hasImaging && !hasLab) return imgName;
  if (hasLab && !hasImaging) return labName;
  return opts.counterLabelById.get(ticket.counter_id) ?? "the counter";
}
