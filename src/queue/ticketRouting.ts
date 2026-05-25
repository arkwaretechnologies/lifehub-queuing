export type TicketRoutingFields = {
  counter_id: string;
  includes_lab?: boolean | null;
  includes_imaging?: boolean | null;
  notes?: string | null;
};

/** Parsed from ticket notes, e.g. `[Active] dept=IMAG`. */
export function parseActiveDept(notes: string | null | undefined): "LAB" | "IMAG" | null {
  const match = (notes ?? "").match(/\[Active\]\s*dept=(\w+)/i);
  if (!match) return null;
  const dept = match[1].toUpperCase();
  if (dept === "LAB" || dept === "IMAG") return dept;
  return null;
}

export function hasSpecimenCollected(notes: string | null | undefined): boolean {
  const match = (notes ?? "").match(/\[Specimen\]\s*collected_at=([^\n\r]*)/i);
  if (!match) return false;
  const value = match[1].trim();
  return value.length > 0 && value.toLowerCase() !== "null";
}

/**
 * Lab + imaging share one queue number under the laboratory counter.
 * Route each ticket to the TV card that matches the active department.
 */
export function resolveDisplayCounterId(
  ticket: TicketRoutingFields,
  labCounterId: string | null,
  imagingCounterId: string | null,
): string {
  const activeDept = parseActiveDept(ticket.notes);
  if (activeDept === "IMAG" && imagingCounterId) return imagingCounterId;
  if (activeDept === "LAB" && labCounterId) return labCounterId;

  if (imagingCounterId && String(ticket.counter_id) === imagingCounterId) {
    return imagingCounterId;
  }

  const includesLab = Boolean(ticket.includes_lab);
  const includesImaging = Boolean(ticket.includes_imaging);

  if (includesLab && includesImaging && labCounterId && imagingCounterId) {
    return hasSpecimenCollected(ticket.notes) ? imagingCounterId : labCounterId;
  }

  if (includesImaging && !includesLab && imagingCounterId) {
    return imagingCounterId;
  }

  return ticket.counter_id;
}
