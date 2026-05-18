"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaPlaylistItem, QueueScreen } from "@/config/types";
import type { QueueAccent, QueueTicket } from "@/queue/types";
import { QueueBoard } from "@/components/QueueBoard/QueueBoard";
import { StatusBar } from "@/components/StatusBar/StatusBar";
import { MediaPanel } from "@/components/MediaPanel/MediaPanel";
import { buildQueueCard } from "@/queue/buildCards";
import { isSupabaseBrowserConfigured, supabaseBrowser } from "@/db/supabaseBrowser";
import {
  resolveEntranceCounterCode,
  resolveImagingCounterCode,
  resolveLaboratoryCounterCode,
  resolveServiceCounters,
} from "@/queue/displayCounters";
import {
  fetchDiagnosticProgressForTickets,
  fetchPaidImagingRequestIds,
  fetchPaidLabRequestIds,
  refreshQueueTicketsForScreen,
} from "@/queue/issueTicket";
import {
  ticketIncludesImaging,
  ticketIncludesLaboratory,
  ticketsForImagingCard,
  ticketsForLaboratoryCard,
} from "@/queue/labQueuePaidFilter";
import { resolveQueueAnnouncementDestination } from "@/queue/queueActiveDept";
import { cancelAnnouncement, formatQueueForSpeech, speakAnnouncement } from "@/queue/announceClient";

type Counter = { id: string; code: string; name: string; description: string | null };
type Priority = { id: number; code: string; name: string; level: number };
const ACTIVE_STATUSES = ["Waiting", "Called", "Serving", "Completed"] as const;

/** Server action refresh interval; Realtime is primary—this is a backup only. */
const QUEUE_TICKET_POLL_MS = 20_000;

const SERVICE_ACCENTS: QueueAccent[] = ["gold", "purple", "red", "orange", "pink"];

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
  imaging_request_id?: string | null;
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
    imaging_request_id: row.imaging_request_id ? String(row.imaging_request_id) : null,
    includes_lab: row.includes_lab ?? null,
    includes_imaging: row.includes_imaging ?? null,
    notes: row.notes ? String(row.notes) : null,
  };
}

export function QueueScreenClient({
  screenId,
  screen,
  counters,
  priorities,
  initialTickets,
  initialPaidLabRequestIds,
  initialPaidImagingRequestIds,
  initialLabCollectedIds,
  initialImagingCapturedIds,
  labCounterId,
  imagingCounterId,
  playlistItems,
  playlistLoop,
}: {
  screenId: string;
  screen: QueueScreen | null;
  counters: Counter[];
  priorities: Priority[];
  initialTickets: QueueTicket[];
  initialPaidLabRequestIds: string[];
  initialPaidImagingRequestIds: string[];
  initialLabCollectedIds: string[];
  initialImagingCapturedIds: string[];
  labCounterId: string | null;
  imagingCounterId: string | null;
  playlistItems: MediaPlaylistItem[];
  playlistLoop: boolean;
}) {
  const [connected, setConnected] = useState(false);
  const [tickets, setTickets] = useState<QueueTicket[]>(initialTickets);
  const [paidLabRequestIds, setPaidLabRequestIds] = useState<Set<string> | null>(
    () => new Set(initialPaidLabRequestIds),
  );
  const [paidImagingRequestIds, setPaidImagingRequestIds] = useState<Set<string> | null>(
    () => new Set(initialPaidImagingRequestIds),
  );
  const [labCollectedIds, setLabCollectedIds] = useState<Set<string>>(
    () => new Set(initialLabCollectedIds),
  );
  const [imagingCapturedIds, setImagingCapturedIds] = useState<Set<string>>(
    () => new Set(initialImagingCapturedIds),
  );
  const lastTicketSnapshotRef = useRef<Map<string, { status: string; called_at: string | null }>>(new Map());
  const lastSpokenKeyRef = useRef<string | null>(null);

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
  const imagingCode = useMemo(() => resolveImagingCounterCode(screen, counters), [screen, counters]);

  const laboratoryAnnouncementLabel = useMemo(() => {
    const c = labCode ? counters.find((x) => x.code.toUpperCase() === labCode.toUpperCase()) : null;
    return (c?.name ?? "").trim() || "Laboratory";
  }, [counters, labCode]);

  const imagingAnnouncementLabel = useMemo(() => {
    const c = imagingCode ? counters.find((x) => x.code.toUpperCase() === imagingCode.toUpperCase()) : null;
    return (c?.name ?? "").trim() || "Imaging";
  }, [counters, imagingCode]);

  const labTicketsForCard = useMemo(
    () => ticketsForLaboratoryCard(tickets, labCounterId, paidLabRequestIds, labCollectedIds),
    [tickets, labCounterId, paidLabRequestIds, labCollectedIds],
  );

  const imagingTicketsForCard = useMemo(
    () => ticketsForImagingCard(tickets, imagingCounterId, paidImagingRequestIds, imagingCapturedIds),
    [tickets, imagingCounterId, paidImagingRequestIds, imagingCapturedIds],
  );

  const announcementTickets = tickets;

  useEffect(() => {
    const linkedIds = [
      ...new Set(
        tickets
          .filter((t) => ticketIncludesLaboratory(t, labCounterId))
          .map((t) => String(t.lab_request_id ?? "").trim())
          .filter(Boolean),
      ),
    ];
    if (linkedIds.length === 0) {
      setPaidLabRequestIds(new Set());
      return;
    }

    let cancelled = false;
    void fetchPaidLabRequestIds(linkedIds)
      .then((paid) => {
        if (!cancelled) setPaidLabRequestIds(new Set(paid));
      })
      .catch(() => {
        if (!cancelled) setPaidLabRequestIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [tickets, labCounterId]);

  useEffect(() => {
    const linkedIds = [
      ...new Set(
        tickets
          .filter((t) => ticketIncludesImaging(t, imagingCounterId))
          .map((t) => String(t.imaging_request_id ?? "").trim())
          .filter(Boolean),
      ),
    ];
    if (linkedIds.length === 0) {
      setPaidImagingRequestIds(new Set());
      return;
    }

    let cancelled = false;
    void fetchPaidImagingRequestIds(linkedIds)
      .then((paid) => {
        if (!cancelled) setPaidImagingRequestIds(new Set(paid));
      })
      .catch(() => {
        if (!cancelled) setPaidImagingRequestIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [tickets, imagingCounterId]);

  useEffect(() => {
    const labIds = [
      ...new Set(
        tickets
          .filter((t) => ticketIncludesLaboratory(t, labCounterId))
          .map((t) => String(t.lab_request_id ?? "").trim())
          .filter(Boolean),
      ),
    ];
    const imgIds = [
      ...new Set(
        tickets
          .filter((t) => ticketIncludesImaging(t, imagingCounterId))
          .map((t) => String(t.imaging_request_id ?? "").trim())
          .filter(Boolean),
      ),
    ];
    if (labIds.length === 0 && imgIds.length === 0) {
      setLabCollectedIds(new Set());
      setImagingCapturedIds(new Set());
      return;
    }

    let cancelled = false;
    void fetchDiagnosticProgressForTickets(labIds, imgIds)
      .then(({ labCollectedIds: labDone, imagingCapturedIds: imgDone }) => {
        if (!cancelled) {
          setLabCollectedIds(new Set(labDone));
          setImagingCapturedIds(new Set(imgDone));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLabCollectedIds(new Set());
          setImagingCapturedIds(new Set());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tickets, labCounterId, imagingCounterId]);

  useEffect(() => {
    if (!counterIdsToWatch.length) return;
    if (!isSupabaseBrowserConfigured()) {
      setConnected(false);
      return;
    }
    let cancelled = false;
    const supabase = supabaseBrowser();
    const watchSet = new Set(counterIdsToWatch);

    const applyRowChange = (payload: {
      eventType: "INSERT" | "UPDATE" | "DELETE";
      new: Record<string, unknown> | null;
      old: Record<string, unknown> | null;
    }) => {
      if (cancelled) return;
      setConnected(true);

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
        if (idx >= 0) next[idx] = mapped;
        else next.push(mapped);
        return next;
      });
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
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [counterIdsToWatch, screenId]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const called = announcementTickets
      .filter((t) => t.status === "Called" && !!t.called_at)
      .slice()
      .sort((a, b) => String(b.called_at).localeCompare(String(a.called_at)));
    const latest = called[0] ?? null;
    if (!latest?.called_at) return;

    const prev = lastTicketSnapshotRef.current.get(latest.id);
    const becameCalled = prev?.status !== "Called" || prev?.called_at !== latest.called_at;
    const speakKey = `${latest.id}:${latest.called_at}`;
    if (!becameCalled) return;
    if (lastSpokenKeyRef.current === speakKey) return;

    const destinationLabel = resolveQueueAnnouncementDestination(latest, {
      counterLabelById,
      laboratoryLabel: laboratoryAnnouncementLabel,
      imagingLabel: imagingAnnouncementLabel,
    });
    const spokenQueue = formatQueueForSpeech(latest.queue_display);
    const englishText = `Now serving ${spokenQueue}. Please proceed to ${destinationLabel}.`;

    speakAnnouncement(englishText);
    lastSpokenKeyRef.current = speakKey;
  }, [
    announcementTickets,
    counterLabelById,
    laboratoryAnnouncementLabel,
    imagingAnnouncementLabel,
  ]);

  useEffect(() => {
    return () => {
      cancelAnnouncement();
    };
  }, []);

  useEffect(() => {
    const snap = new Map<string, { status: string; called_at: string | null }>();
    announcementTickets.forEach((t) => snap.set(t.id, { status: t.status, called_at: t.called_at }));
    lastTicketSnapshotRef.current = snap;
  }, [announcementTickets]);

  const cards = useMemo(() => {
    const byCounterId = new Map<string, QueueTicket[]>();
    tickets.forEach((t) => {
      const arr = byCounterId.get(t.counter_id) ?? [];
      arr.push(t);
      byCounterId.set(t.counter_id, arr);
    });

    const entranceCode = resolveEntranceCounterCode(screen, counters);
    const entranceCounterId = entranceCode
      ? (counterIdByCode.get(entranceCode) ?? counterIdByCode.get(entranceCode.toUpperCase()) ?? null)
      : null;
    const entranceTickets = entranceCounterId ? (byCounterId.get(entranceCounterId) ?? []) : [];
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

    const labMeta = labCode ? counters.find((c) => c.code.toUpperCase() === labCode.toUpperCase()) : null;
    const imagingMeta = imagingCode
      ? counters.find((c) => c.code.toUpperCase() === imagingCode.toUpperCase())
      : null;

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
        tickets: labTicketsForCard,
        cardDept: "LAB",
      }),
    ];

    if (imagingCounterId || imagingTicketsForCard.length > 0) {
      result.push(
        buildQueueCard({
          title: imagingMeta?.name ?? "Imaging",
          subtitle: imagingMeta?.description ?? "Radiology",
          accent: "cyan",
          tickets: imagingTicketsForCard,
          cardDept: "IMAG",
        }),
      );
    }

    serviceCounters.forEach((counter, i) => {
      const id = counterIdByCode.get(counter.code) ?? counterIdByCode.get(counter.code.toUpperCase());
      const counterTickets = id ? (byCounterId.get(id) ?? []) : [];
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
  }, [
    tickets,
    screen,
    counters,
    counterIdByCode,
    priorityIdByCode,
    labCode,
    imagingCode,
    labTicketsForCard,
    imagingTicketsForCard,
    imagingCounterId,
  ]);

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
      <StatusBar connected={connected} screenId={screenId} />
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