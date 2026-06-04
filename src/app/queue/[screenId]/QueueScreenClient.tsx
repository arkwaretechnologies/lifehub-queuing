"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaPlaylistItem, QueueScreen } from "@/config/types";
import type { QueueAccent, QueueTicket } from "@/queue/types";
import { QueueBoard } from "@/components/QueueBoard/QueueBoard";
import { StatusBar } from "@/components/StatusBar/StatusBar";
import { MediaPanel } from "@/components/MediaPanel/MediaPanel";
import { buildQueueCard } from "@/queue/buildCards";
import { isSupabaseBrowserConfigured, supabaseBrowser } from "@/db/supabaseBrowser";
import { resolveEntranceCounterCode, resolveLaboratoryCounterCode, resolveServiceCounters } from "@/queue/displayCounters";
import { fetchPaidLabRequestIds, refreshQueueTicketsForScreen } from "@/queue/issueTicket";
import {
  filterTicketsForLaboratoryPaidDisplay,
  isLaboratoryTicketVisibleOnQueue,
} from "@/queue/labQueuePaidFilter";
import { buildAnnouncementText, WARM_ANNOUNCEMENT_PHRASES } from "@/queue/announceText";
import { resolveDisplayCounterId } from "@/queue/ticketRouting";
import { cancelAnnouncement, prefetchAnnouncement, speakAnnouncement } from "@/queue/announceClient";
import { shouldAnnounceOnCalledAtChange } from "@/queue/queueRecall";

type Counter = { id: string; code: string; name: string; description: string | null };
type Priority = { id: number; code: string; name: string; level: number };
const ACTIVE_STATUSES = ["Waiting", "Called", "Serving", "Completed", "Collected", "Captured"] as const;

/** Server action refresh interval; Realtime is primary—this is a backup only. */
const QUEUE_TICKET_POLL_MS = 5_000;

const SERVICE_ACCENTS: QueueAccent[] = ["gold", "purple", "red", "cyan", "orange", "pink"];

type QueueTicketRow = {
  id: string;
  counter_id: string;
  priority_id: number;
  queue_number: number;
  queue_display: string;
  ticket_date: string;
  status: string;
  issued_at: string;
  called_at?: string | null;
  serving_at?: string | null;
  completed_at?: string | null;
  lab_request_id?: string | null;
  includes_lab?: boolean | null;
  includes_imaging?: boolean | null;
  notes?: string | null;
};

function normalizeTicketRow(row: Partial<QueueTicketRow> | null | undefined): QueueTicket | null {
  if (!row?.id || row.counter_id == null || row.counter_id === "") return null;
  const status = row.status;
  if (!status || !ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number])) return null;
  return {
    id: String(row.id),
    counter_id: String(row.counter_id),
    priority_id: Number(row.priority_id),
    queue_number: Number(row.queue_number),
    queue_display: String(row.queue_display),
    ticket_date: String(row.ticket_date),
    status: status as QueueTicket["status"],
    issued_at: String(row.issued_at),
    called_at: row.called_at ? String(row.called_at) : null,
    serving_at: row.serving_at ? String(row.serving_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    lab_request_id: row.lab_request_id ? String(row.lab_request_id) : null,
    includes_lab: Boolean(row.includes_lab),
    includes_imaging: Boolean(row.includes_imaging),
    notes: row.notes != null ? String(row.notes) : null,
  };
}

export function QueueScreenClient({
  screenId,
  screen,
  counters,
  priorities,
  initialTickets,
  initialPaidLabRequestIds,
  playlistItems,
  playlistLoop,
}: {
  screenId: string;
  screen: QueueScreen | null;
  counters: Counter[];
  priorities: Priority[];
  initialTickets: QueueTicket[];
  initialPaidLabRequestIds: string[];
  playlistItems: MediaPlaylistItem[];
  playlistLoop: boolean;
}) {
  const [tickets, setTickets] = useState<QueueTicket[]>(initialTickets);
  const [paidLabRequestIds, setPaidLabRequestIds] = useState<Set<string> | null>(
    () => new Set(initialPaidLabRequestIds),
  );
  const lastTicketSnapshotRef = useRef<Map<string, { status: string; called_at: string | null }>>(new Map());
  const lastSpokenKeyRef = useRef<string | null>(null);
  const paidLabRequestIdsRef = useRef<Set<string> | null>(paidLabRequestIds);
  const counterLabelByIdRef = useRef(new Map<string, string>());
  const labCounterIdRef = useRef<string | null>(null);
  const imagingCounterIdRef = useRef<string | null>(null);

  useEffect(() => {
    paidLabRequestIdsRef.current = paidLabRequestIds;
  }, [paidLabRequestIds]);

  function setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
  }

  function commitPaidLabRequestIds(next: Set<string>) {
    setPaidLabRequestIds((prev) => (prev && setsEqual(prev, next) ? prev : next));
  }

  const counterIdByCode = useMemo(() => {
    const m = new Map<string, string>();
    counters.forEach((c) => {
      const id = String(c.id);
      m.set(c.code, id);
      m.set(c.code.toUpperCase(), id);
    });
    return m;
  }, [counters]);

  const counterLabelById = useMemo(() => {
    const m = new Map<string, string>();
    counters.forEach((c) => {
      const id = String(c.id);
      const title = (c.name ?? "").trim() || c.code;
      m.set(id, title);
    });
    return m;
  }, [counters]);

  const priorityIdByCode = useMemo(() => {
    const m = new Map<string, number>();
    priorities.forEach((p) => {
      m.set(p.code, p.id);
      m.set(p.code.toUpperCase(), p.id);
    });
    return m;
  }, [priorities]);

  const counterIdsToWatch = useMemo(
    () => [...new Set(counters.map((c) => String(c.id)))].sort(),
    [counters],
  );

  const counterWatchKey = useMemo(() => counterIdsToWatch.join("|"), [counterIdsToWatch]);

  const labCode = useMemo(() => resolveLaboratoryCounterCode(screen, counters), [screen, counters]);
  const labCounterId = useMemo(() => {
    if (!labCode) return null;
    return counterIdByCode.get(labCode) ?? counterIdByCode.get(labCode.toUpperCase()) ?? null;
  }, [labCode, counterIdByCode]);

  const imagingCounterId = useMemo(() => {
    const imaging = counters.find(
      (c) =>
        c.code.toUpperCase().includes("IMAG") ||
        (c.name ?? "").toUpperCase().includes("IMAGING") ||
        (c.description ?? "").toUpperCase().includes("IMAGING"),
    );
    return imaging ? String(imaging.id) : null;
  }, [counters]);

  const displayTickets = useMemo(
    () => filterTicketsForLaboratoryPaidDisplay(tickets, labCounterId, paidLabRequestIds),
    [tickets, labCounterId, paidLabRequestIds],
  );

  useEffect(() => {
    counterLabelByIdRef.current = counterLabelById;
    labCounterIdRef.current = labCounterId;
    imagingCounterIdRef.current = imagingCounterId;
  }, [counterLabelById, labCounterId, imagingCounterId]);

  useEffect(() => {
    for (const phrase of WARM_ANNOUNCEMENT_PHRASES) {
      prefetchAnnouncement(phrase);
    }
  }, []);

  function prefetchIfNewlyCalled(ticket: QueueTicket): void {
    if (ticket.status !== "Called" || !ticket.called_at) return;
    const prev = lastTicketSnapshotRef.current.get(ticket.id);
    const becameCalled = prev?.status !== "Called" || prev?.called_at !== ticket.called_at;
    if (!becameCalled) return;
    const text = buildAnnouncementText(
      ticket,
      counterLabelByIdRef.current,
      labCounterIdRef.current,
      imagingCounterIdRef.current,
    );
    prefetchAnnouncement(text);
  }

  useEffect(() => {
    if (!labCounterId) {
      commitPaidLabRequestIds(new Set());
      return;
    }

    const linkedIds = [
      ...new Set(
        tickets
          .filter((t) => t.counter_id === labCounterId)
          .map((t) => String(t.lab_request_id ?? "").trim())
          .filter(Boolean),
      ),
    ];
    if (linkedIds.length === 0) {
      commitPaidLabRequestIds(new Set());
      return;
    }

    let cancelled = false;
    void fetchPaidLabRequestIds(linkedIds)
      .then((paid) => {
        if (!cancelled) commitPaidLabRequestIds(new Set(paid));
      })
      .catch(() => {
        if (!cancelled) commitPaidLabRequestIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [tickets, labCounterId]);

  useEffect(() => {
    if (!counterIdsToWatch.length) return;
    if (!isSupabaseBrowserConfigured()) return;
    let cancelled = false;
    const supabase = supabaseBrowser();
    const watchSet = new Set(counterIdsToWatch);

    const applyRowChange = (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: Record<string, unknown> | null;
      old: Record<string, unknown> | null;
    }) => {
      if (cancelled) return;

      const rowNew = payload.new as Partial<QueueTicketRow> | null;
      const rowOld = payload.old as Partial<QueueTicketRow> | null;
      const newCounterId =
        rowNew?.counter_id != null && rowNew.counter_id !== "" ? String(rowNew.counter_id) : null;
      const oldCounterId =
        rowOld?.counter_id != null && rowOld.counter_id !== "" ? String(rowOld.counter_id) : null;
      const affectsThisScreen =
        (newCounterId && watchSet.has(newCounterId)) || (oldCounterId && watchSet.has(oldCounterId));
      if (!affectsThisScreen) return;

      const rowId = String(
        (payload.eventType === "DELETE" ? rowOld?.id : rowNew?.id ?? rowOld?.id) ?? "",
      );
      if (!rowId) return;

      setTickets((prev) => {
        const next = prev.slice();
        const idx = next.findIndex((t) => t.id === rowId);

        if (payload.eventType === "DELETE") {
          if (idx >= 0) next.splice(idx, 1);
          return next;
        }

        const mapped = normalizeTicketRow(rowNew);
        if (!mapped || !watchSet.has(mapped.counter_id)) {
          if (idx >= 0) next.splice(idx, 1);
          return next;
        }
        const visibleOnLabQueue =
          paidLabRequestIdsRef.current === null ||
          isLaboratoryTicketVisibleOnQueue(mapped, labCounterIdRef.current, paidLabRequestIdsRef.current);
        if (!visibleOnLabQueue) {
          if (idx >= 0) next.splice(idx, 1);
          return next;
        }
        prefetchIfNewlyCalled(mapped);
        if (idx >= 0) next[idx] = mapped;
        else next.push(mapped);
        return next;
      });
    };

    const refreshTickets = async () => {
      try {
        const rows = await refreshQueueTicketsForScreen(screenId);
        if (!cancelled) setTickets(rows);
      } catch {
        /* keep last snapshot on failure */
      }
    };

    const channel = supabase
      .channel(`queue_tickets_${screenId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_tickets" },
        (payload) => applyRowChange(payload as { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown> | null; old: Record<string, unknown> | null }),
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") void refreshTickets();
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [counterWatchKey, screenId, labCounterId]);

  useEffect(() => {
    if (!counterWatchKey.length) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const rows = await refreshQueueTicketsForScreen(screenId);
        if (!cancelled) setTickets(rows);
      } catch {
        /* keep last snapshot on failure */
      }
    };

    const id = window.setInterval(refresh, QUEUE_TICKET_POLL_MS);
    void refresh();

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [screenId, counterWatchKey]);

  // Voice on call + LifeHub recall (recall bumps `called_at` without changing status).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const announceable = displayTickets
      .filter((t) => !!t.called_at && shouldAnnounceOnCalledAtChange(t.status))
      .slice()
      .sort((a, b) => String(b.called_at).localeCompare(String(a.called_at)));
    const latest = announceable[0] ?? null;
    if (!latest?.called_at) return;

    const prev = lastTicketSnapshotRef.current.get(latest.id);
    const calledAtChanged = prev?.called_at !== latest.called_at;
    const enteredAnnounceable =
      !!prev &&
      !shouldAnnounceOnCalledAtChange(prev.status as QueueTicket["status"]) &&
      shouldAnnounceOnCalledAtChange(latest.status);
    if (!calledAtChanged && !enteredAnnounceable) return;

    const speakKey = `${latest.id}:${latest.called_at}`;
    if (lastSpokenKeyRef.current === speakKey) return;

    const englishText = buildAnnouncementText(
      latest,
      counterLabelById,
      labCounterId,
      imagingCounterId,
    );

    prefetchAnnouncement(englishText);
    speakAnnouncement(englishText);
    lastSpokenKeyRef.current = speakKey;
  }, [displayTickets, counterLabelById, labCounterId, imagingCounterId]);

  // Stop any in-flight announcement when the screen unmounts.
  useEffect(() => {
    return () => {
      cancelAnnouncement();
    };
  }, []);

  // Maintain a minimal snapshot for transition detection.
  useEffect(() => {
    const snap = new Map<string, { status: string; called_at: string | null }>();
    displayTickets.forEach((t) => snap.set(t.id, { status: t.status, called_at: t.called_at }));
    lastTicketSnapshotRef.current = snap;
  }, [displayTickets]);

  const cards = useMemo(() => {
    const byDisplayCounterId = new Map<string, QueueTicket[]>();
    displayTickets.forEach((t) => {
      const displayId = resolveDisplayCounterId(t, labCounterId, imagingCounterId);
      const arr = byDisplayCounterId.get(displayId) ?? [];
      arr.push(t);
      byDisplayCounterId.set(displayId, arr);
    });

    // --- Entrance / Reception card ---
    const entranceCode = resolveEntranceCounterCode(screen, counters);
    const entranceCounterId = entranceCode
      ? (counterIdByCode.get(entranceCode) ?? counterIdByCode.get(entranceCode.toUpperCase()) ?? null)
      : null;
    const entranceTickets = entranceCounterId ? (byDisplayCounterId.get(entranceCounterId) ?? []) : [];
    const regularCode = screen?.entrance_regular_priority_code ?? null;
    const priorityCode = screen?.entrance_priority_priority_code ?? null;
    const regularId = regularCode
      ? (priorityIdByCode.get(regularCode) ?? priorityIdByCode.get(regularCode.toUpperCase()) ?? null)
      : null;
    const priorityId = priorityCode
      ? (priorityIdByCode.get(priorityCode) ?? priorityIdByCode.get(priorityCode.toUpperCase()) ?? null)
      : null;

    const splitConfigured = regularId != null || priorityId != null;
    const entranceTicketsForCard = splitConfigured
      ? [
          ...(priorityId != null ? entranceTickets.filter((t) => t.priority_id === priorityId) : []),
          ...(regularId != null ? entranceTickets.filter((t) => t.priority_id === regularId) : []),
        ]
      : entranceTickets;

    // --- Laboratory card (paid visit-linked orders only; matches LifeHub Lab Appointments) ---
    const labTickets = labCounterId ? (byDisplayCounterId.get(labCounterId) ?? []) : [];
    const labMeta = labCode ? counters.find((c) => c.code.toUpperCase() === labCode.toUpperCase()) : null;

    // --- Dynamic service counter cards (doctors, clinics, etc.) ---
    const serviceCounters = resolveServiceCounters(screen, counters);

    const result = [
      buildQueueCard({
        title: "Reception",
        subtitle: "Registration Queue",
        accent: "blue",
        tickets: entranceTicketsForCard,
        nextLimit: 6,
      }),
      buildQueueCard({
        title: labMeta?.name ?? "Laboratory",
        subtitle: labMeta?.description ?? "Collection",
        accent: "green",
        tickets: labTickets,
      }),
    ];

    serviceCounters.forEach((counter, i) => {
      const id = counterIdByCode.get(counter.code) ?? counterIdByCode.get(counter.code.toUpperCase());
      const counterTickets = id ? (byDisplayCounterId.get(id) ?? []) : [];
      result.push(
        buildQueueCard({
          title: counter.name ?? counter.code,
          subtitle: counter.description ?? undefined,
          accent: SERVICE_ACCENTS[i % SERVICE_ACCENTS.length],
          tickets: counterTickets,
        }),
      );
    });

    return result;
  }, [displayTickets, screen, counters, counterIdByCode, priorityIdByCode, labCounterId, labCode, imagingCounterId]);

  return (
    <div
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        gap: 0,
        background: "#0a0f1a",
        overflow: "hidden",
      }}
    >
      <StatusBar />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 38%",
          gap: 16,
          padding: "12px 20px 16px",
          minHeight: 0,
        }}
      >
        <QueueBoard cards={cards} />
        <MediaPanel items={playlistItems} loop={playlistLoop} />
      </div>
    </div>
  );
}
