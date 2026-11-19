"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QueueScreen } from "@/config/types";
import type { QueueAccent, QueueTicket } from "@/queue/types";
import { QueueBoard } from "@/components/QueueBoard/QueueBoard";
import { StatusBar } from "@/components/StatusBar/StatusBar";
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
import { EnableSoundBar } from "@/components/VoiceAgent/EnableSoundBar";
import { VoiceAgentDock } from "@/components/VoiceAgent/VoiceAgentDock";
import {
  cancelAnnouncement,
  flushPendingAnnouncements,
  flushQueuedTicketAnnouncements,
  prefetchAnnouncement,
  speakAnnouncement,
} from "@/queue/announceClient";
import { shouldCommitAnnouncementSnapshot } from "@/queue/announceSpeakOutcome";
import { queueTicketAnnouncement, type TicketAnnounceCommit } from "@/queue/ticketAnnounceQueue";
import {
  isAnnouncementAudioUnlocked,
  isPiperVoiceModelLoaded,
  PIPER_BOOT_PHASE_LABELS,
  preloadPiperVoice,
  resetPiperVoiceBoot,
  setActivePiperVoice,
  setAnnouncementAudioUnlocked,
  unlockAnnouncementAudio,
  type PiperBootPhase,
} from "@/queue/piperTts";
import { DEFAULT_PIPER_VOICE_CHOICE, type PiperVoiceChoice } from "@/queue/piperVoices";
import {
  readSessionVoiceChoice,
  resolveLobbyVoiceChoice,
  writeSessionVoiceChoice,
} from "@/queue/voiceSession";
import {
  DEFAULT_VOICE_ECHO,
  DEFAULT_VOICE_VOLUME,
  initVoiceEcho,
  initVoiceVolume,
  setVoiceEcho,
  setVoiceVolume,
} from "@/queue/voiceVolume";
import {
  announcementSpeakKey,
  pickTicketsToAnnounce,
  shouldAnnounceOnCalledAtChange,
  snapshotActiveDept,
  ticketNeedsAnnouncement,
  ticketSnapshotFromTicket,
  type TicketSnapshot,
} from "@/queue/queueRecall";

type Counter = { id: string; code: string; name: string; description: string | null };
type Priority = { id: number; code: string; name: string; level: number };
const ACTIVE_STATUSES = ["Waiting", "Called", "Serving", "Completed", "Collected", "Captured"] as const;

/** Server action refresh interval; Realtime is primary—this is a backup only. */
const QUEUE_TICKET_POLL_MS = 5_000;

const SERVICE_ACCENTS: QueueAccent[] = ["gold", "purple", "red", "cyan", "orange", "pink"];

/** Minimum time on the voice boot overlay so progress is readable. */
const VOICE_BOOT_MIN_MS = 1400;
/** Bar advance before warmup (download + engine). */
const PRELOAD_PROGRESS_FROM = 40;
const PRELOAD_PROGRESS_TO = 68;
const PRELOAD_PROGRESS_CREEP_MS = 180_000;
/** Warmup (ONNX in RAM + first speak) is the slowest step on TV — creep separately. */
const WARMUP_PROGRESS_FROM = 68;
const WARMUP_PROGRESS_TO = 97;
const WARMUP_PROGRESS_CREEP_MS = 600_000;
/** Voice dropdown switch — engine stays up; shorter UI creep than first lobby load. */
const SWITCH_PRELOAD_CREEP_MS = 45_000;
const SWITCH_WARMUP_CREEP_MS = 120_000;

type VoiceBootKind = "initial" | "switch" | "retry";

const VOICE_PHASE_PROGRESS: Record<PiperBootPhase, number> = {
  checking: 42,
  engine: 52,
  model: 58,
  warmup: 72,
};

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

function normalizeTicketRow(
  row: Partial<QueueTicketRow> | null | undefined,
  prior?: QueueTicket | null,
): QueueTicket | null {
  if (!row?.id) return null;
  const counterId =
    row.counter_id != null && row.counter_id !== "" ? String(row.counter_id) : prior?.counter_id;
  if (!counterId) return null;
  const status = (row.status ?? prior?.status) as string | undefined;
  if (!status || !ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number])) return null;
  return {
    id: String(row.id),
    counter_id: counterId,
    priority_id: Number(row.priority_id ?? prior?.priority_id ?? 0),
    queue_number: Number(row.queue_number ?? prior?.queue_number ?? 0),
    queue_display: String(row.queue_display ?? prior?.queue_display ?? ""),
    ticket_date: String(row.ticket_date ?? prior?.ticket_date ?? ""),
    status: status as QueueTicket["status"],
    issued_at: String(row.issued_at ?? prior?.issued_at ?? ""),
    called_at:
      row.called_at != null && row.called_at !== ""
        ? String(row.called_at)
        : (prior?.called_at ?? null),
    serving_at:
      row.serving_at != null && row.serving_at !== ""
        ? String(row.serving_at)
        : (prior?.serving_at ?? null),
    completed_at:
      row.completed_at != null && row.completed_at !== ""
        ? String(row.completed_at)
        : (prior?.completed_at ?? null),
    lab_request_id:
      row.lab_request_id != null && row.lab_request_id !== ""
        ? String(row.lab_request_id)
        : (prior?.lab_request_id ?? null),
    includes_lab: row.includes_lab != null ? Boolean(row.includes_lab) : Boolean(prior?.includes_lab),
    includes_imaging:
      row.includes_imaging != null ? Boolean(row.includes_imaging) : Boolean(prior?.includes_imaging),
    notes: row.notes != null ? String(row.notes) : (prior?.notes ?? null),
  };
}

export function QueueScreenClient({
  screenId,
  screen,
  counters,
  priorities,
  initialTickets,
  initialPaidLabRequestIds,
}: {
  screenId: string;
  screen: QueueScreen | null;
  counters: Counter[];
  priorities: Priority[];
  initialTickets: QueueTicket[];
  initialPaidLabRequestIds: string[];
}) {
  const [tickets, setTickets] = useState<QueueTicket[]>(initialTickets);
  const [paidLabRequestIds, setPaidLabRequestIds] = useState<Set<string> | null>(
    () => new Set(initialPaidLabRequestIds),
  );
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceBootProgress, setVoiceBootProgress] = useState(0);
  const [voiceBootStatus, setVoiceBootStatus] = useState<"loading" | "error">("loading");
  const [voiceBootError, setVoiceBootError] = useState<string | null>(null);
  const [voiceBootPhase, setVoiceBootPhase] = useState<PiperBootPhase | null>(null);
  const [voiceBootNonce, setVoiceBootNonce] = useState(0);
  const voiceBootKindRef = useRef<VoiceBootKind>("initial");
  // Start with the server-safe default; localStorage is read after mount (avoids hydration mismatch).
  const [activeVoice, setActiveVoice] = useState<PiperVoiceChoice>(DEFAULT_PIPER_VOICE_CHOICE);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [voiceVolume, setVoiceVolumeState] = useState(DEFAULT_VOICE_VOLUME);
  const [voiceEcho, setVoiceEchoState] = useState(DEFAULT_VOICE_ECHO);
  const lastTicketSnapshotRef = useRef<Map<string, TicketSnapshot>>(new Map());
  const lastSpokenKeyByTicketRef = useRef<Map<string, string>>(new Map());
  const initialSeedTicketIdsRef = useRef<Set<string>>(new Set());
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

  const beginVoiceBoot = useCallback((kind: VoiceBootKind) => {
    const resetEngine = kind === "retry";
    resetPiperVoiceBoot({ resetEngine });
    voiceBootKindRef.current = kind;
    setVoiceReady(false);
    setVoiceBootStatus("loading");
    setVoiceBootProgress(kind === "switch" ? 55 : 0);
    setVoiceBootError(null);
    setVoiceBootPhase(null);
    setVoiceBootNonce((n) => n + 1);
  }, []);

  const retryVoiceBoot = useCallback(() => {
    beginVoiceBoot("retry");
  }, [beginVoiceBoot]);

  const applyAnnouncementCommits = useCallback((commits: TicketAnnounceCommit[]) => {
    for (const item of commits) {
      lastSpokenKeyByTicketRef.current.set(item.ticketId, item.speakKey);
      lastTicketSnapshotRef.current.set(item.ticketId, item.snapshot);
    }
  }, []);

  const handleEchoChange = useCallback((value: number) => {
    setVoiceEcho(value);
    setVoiceEchoState(value);
  }, []);

  const handleVolumeChange = useCallback((value: number) => {
    setVoiceVolume(value);
    setVoiceVolumeState(value);
  }, []);

  const handleVoiceChange = useCallback(
    (choice: PiperVoiceChoice) => {
      writeSessionVoiceChoice(choice);
      setActiveVoice(choice);
      setActivePiperVoice(choice);
      if (isPiperVoiceModelLoaded(choice)) {
        setVoiceBootError(null);
        setVoiceBootStatus("loading");
        setVoiceBootProgress(100);
        setVoiceReady(true);
        setVoiceBootPhase(null);
        return;
      }
      beginVoiceBoot("switch");
    },
    [beginVoiceBoot],
  );

  useEffect(() => {
    setAudioUnlocked(isAnnouncementAudioUnlocked());
    const stored = readSessionVoiceChoice();
    if (stored) setActiveVoice(stored);
    setVoiceVolumeState(initVoiceVolume());
    setVoiceEchoState(initVoiceEcho());
  }, []);

  useEffect(() => {
    resetPiperVoiceBoot({ resetEngine: false });
    let cancelled = false;
    let raf = 0;
    let creepRaf = 0;
    let warmupCreepRaf = 0;
    const started = performance.now();

    setVoiceReady(false);
    setVoiceBootStatus("loading");
    setVoiceBootError(null);
    setVoiceBootPhase(null);

    const tickProgress = (target: number) => {
      cancelAnimationFrame(raf);
      const step = () => {
        if (cancelled) return;
        setVoiceBootProgress((prev) => {
          if (prev >= target) return prev;
          const next = Math.min(target, prev + Math.max(0.8, (target - prev) * 0.12));
          if (next < target) raf = requestAnimationFrame(step);
          return next;
        });
      };
      raf = requestAnimationFrame(step);
    };

    const stopPreloadCreep = () => {
      cancelAnimationFrame(creepRaf);
    };

    const bootKind = voiceBootKindRef.current;
    const preloadCreepMs =
      bootKind === "switch" ? SWITCH_PRELOAD_CREEP_MS : PRELOAD_PROGRESS_CREEP_MS;
    const warmupCreepMs = bootKind === "switch" ? SWITCH_WARMUP_CREEP_MS : WARMUP_PROGRESS_CREEP_MS;
    const creepFrom = bootKind === "switch" ? 55 : PRELOAD_PROGRESS_FROM;
    const creepTo = PRELOAD_PROGRESS_TO;

    const startPreloadCreep = () => {
      stopPreloadCreep();
      const creepStart = performance.now();
      const step = () => {
        if (cancelled) return;
        const t = Math.min(1, (performance.now() - creepStart) / preloadCreepMs);
        const value = creepFrom + t * (creepTo - creepFrom);
        setVoiceBootProgress((prev) => Math.max(prev, value));
        if (t < 1) creepRaf = requestAnimationFrame(step);
      };
      creepRaf = requestAnimationFrame(step);
    };

    const stopWarmupCreep = () => {
      cancelAnimationFrame(warmupCreepRaf);
    };

    const startWarmupCreep = () => {
      stopWarmupCreep();
      const creepStart = performance.now();
      const step = () => {
        if (cancelled) return;
        const t = Math.min(1, (performance.now() - creepStart) / warmupCreepMs);
        const value =
          WARMUP_PROGRESS_FROM + t * (WARMUP_PROGRESS_TO - WARMUP_PROGRESS_FROM);
        setVoiceBootProgress((prev) => Math.max(prev, value));
        if (t < 1) warmupCreepRaf = requestAnimationFrame(step);
      };
      warmupCreepRaf = requestAnimationFrame(step);
    };

    const isSwitchBoot = bootKind === "switch";

    if (!isSwitchBoot) tickProgress(12);

    void (async () => {
      try {
        if (!isSwitchBoot) {
          tickProgress(28);
          let serverVoice: string | undefined;
          const voiceRes = await fetch("/api/config/voice");
          if (voiceRes.ok) {
            const voiceCfg = (await voiceRes.json()) as { piper_voice?: string };
            serverVoice = voiceCfg.piper_voice;
          }
          const choice = resolveLobbyVoiceChoice(serverVoice);
          if (!cancelled) {
            setActiveVoice(choice);
            setActivePiperVoice(choice);
          }
          if (cancelled) return;
          tickProgress(40);
        } else {
          const choice = resolveLobbyVoiceChoice(undefined);
          if (!cancelled) {
            setActiveVoice(choice);
            setActivePiperVoice(choice);
          }
          if (cancelled) return;
        }
        startPreloadCreep();
        await preloadPiperVoice({
          onPhase: (phase) => {
            if (cancelled) return;
            setVoiceBootPhase(phase);
            tickProgress(VOICE_PHASE_PROGRESS[phase]);
            if (phase === "warmup") {
              stopPreloadCreep();
              startWarmupCreep();
            }
          },
          // Real bytes from the shared downloader: drives the dial from 40% → 70% during download.
          onDownloadProgress: (fraction) => {
            if (cancelled) return;
            stopPreloadCreep();
            const value = PRELOAD_PROGRESS_FROM + fraction * (70 - PRELOAD_PROGRESS_FROM);
            setVoiceBootProgress((prev) => Math.max(prev, value));
          },
        });
        stopPreloadCreep();
        stopWarmupCreep();
        if (cancelled) return;
        if (!isSwitchBoot) {
          tickProgress(88);
          const elapsed = performance.now() - started;
          const wait = Math.max(0, VOICE_BOOT_MIN_MS - elapsed);
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          if (cancelled) return;
          setVoiceBootProgress(100);
          await new Promise((r) => setTimeout(r, 280));
          if (cancelled) return;
        } else {
          setVoiceBootProgress(100);
        }
        setVoiceReady(true);
        setVoiceBootPhase(null);
        if (!isSwitchBoot) {
          for (const phrase of WARM_ANNOUNCEMENT_PHRASES) {
            prefetchAnnouncement(phrase);
          }
        }
      } catch (err) {
        console.error("[voice-boot]", err);
        stopPreloadCreep();
        stopWarmupCreep();
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Voice engine failed to start";
        setVoiceBootError(msg);
        setVoiceBootStatus("error");
        setVoiceBootProgress(100);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopPreloadCreep();
      stopWarmupCreep();
    };
  }, [voiceBootNonce]);

  const announceTicketIfNeeded = useCallback(
    (
      ticket: QueueTicket,
      prevSnap?: TicketSnapshot,
      options?: { fromRealtime?: boolean; fromPoll?: boolean },
    ): void => {
      const prev = prevSnap ?? lastTicketSnapshotRef.current.get(ticket.id);
      const pollFirstSight =
        Boolean(options?.fromPoll) &&
        !prev &&
        !initialSeedTicketIdsRef.current.has(ticket.id);
      if (
        !ticketNeedsAnnouncement(ticket, prev, {
          fromRealtime: options?.fromRealtime,
          pollFirstSight,
        })
      ) {
        return;
      }

      const activeDept = snapshotActiveDept(ticket.notes);
      const speakKey = announcementSpeakKey(ticket.id, ticket.called_at, activeDept);
      if (lastSpokenKeyByTicketRef.current.get(ticket.id) === speakKey) return;

      if (process.env.NODE_ENV === "development") {
        console.debug("[voice]", ticket.id, ticket.queue_display, {
          speakKey,
          pollFirstSight: pollFirstSight || undefined,
          fromRealtime: options?.fromRealtime || undefined,
        });
      }

      const text = buildAnnouncementText(
        ticket,
        counterLabelByIdRef.current,
        labCounterIdRef.current,
        imagingCounterIdRef.current,
      );
      prefetchAnnouncement(text);

      const commit: TicketAnnounceCommit = {
        ticketId: ticket.id,
        speakKey,
        text,
        snapshot: ticketSnapshotFromTicket(ticket),
      };

      if (!voiceReady) {
        queueTicketAnnouncement(commit);
        return;
      }

      const result = speakAnnouncement(text, { ifLocked: "none" });
      if (shouldCommitAnnouncementSnapshot(result)) {
        applyAnnouncementCommits([commit]);
      } else if (result === "queued_unlock") {
        queueTicketAnnouncement(commit);
      }
    },
    [voiceReady, applyAnnouncementCommits],
  );

  const drainDeferredAnnouncements = useCallback(() => {
    if (!voiceReady || !isAnnouncementAudioUnlocked()) return;
    const commits = flushQueuedTicketAnnouncements((text) =>
      speakAnnouncement(text, { ifLocked: "none" }),
    );
    applyAnnouncementCommits(commits);
    const pollPickOptions = {
      fromPoll: true as const,
      seededAtLoadIds: initialSeedTicketIdsRef.current,
    };
    for (const ticket of pickTicketsToAnnounce(
      tickets,
      lastTicketSnapshotRef.current,
      pollPickOptions,
    )) {
      announceTicketIfNeeded(ticket, undefined, { fromPoll: true });
    }
  }, [voiceReady, tickets, applyAnnouncementCommits, announceTicketIfNeeded]);

  const handleTestVoice = useCallback(async () => {
    if (!voiceReady) return;
    if (!isAnnouncementAudioUnlocked()) {
      const ok = await unlockAnnouncementAudio();
      if (ok) {
        setAudioUnlocked(true);
        flushPendingAnnouncements();
        drainDeferredAnnouncements();
      }
      return;
    }
    speakAnnouncement("Voice test.");
  }, [voiceReady, drainDeferredAnnouncements]);

  function prefetchIfNewlyCalled(
    ticket: QueueTicket,
    prevSnap?: TicketSnapshot,
    options?: { fromRealtime?: boolean },
  ): void {
    const prev = prevSnap ?? lastTicketSnapshotRef.current.get(ticket.id);
    if (!ticketNeedsAnnouncement(ticket, prev, options)) return;
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

      let refreshAfterPartialRow = false;

      setTickets((prev) => {
        const next = prev.slice();
        const idx = next.findIndex((t) => t.id === rowId);

        if (payload.eventType === "DELETE") {
          if (idx >= 0) next.splice(idx, 1);
          return next;
        }

        const prior = idx >= 0 ? next[idx] : null;
        const prevSnap = prior
          ? ticketSnapshotFromTicket(prior)
          : lastTicketSnapshotRef.current.get(rowId);
        const mapped = normalizeTicketRow(rowNew, prior);
        if (!mapped || !watchSet.has(mapped.counter_id)) {
          if (idx >= 0) next.splice(idx, 1);
          return next;
        }
        if (
          payload.eventType === "UPDATE" &&
          shouldAnnounceOnCalledAtChange(mapped.status) &&
          !mapped.called_at
        ) {
          refreshAfterPartialRow = true;
        }
        const visibleOnLabQueue =
          paidLabRequestIdsRef.current === null ||
          isLaboratoryTicketVisibleOnQueue(mapped, labCounterIdRef.current, paidLabRequestIdsRef.current);
        if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
          prefetchIfNewlyCalled(mapped, prevSnap, { fromRealtime: true });
          announceTicketIfNeeded(mapped, prevSnap, { fromRealtime: true });
        }
        if (!visibleOnLabQueue) {
          if (idx >= 0) next.splice(idx, 1);
          return next;
        }
        if (idx >= 0) next[idx] = mapped;
        else next.push(mapped);
        return next;
      });

      if (refreshAfterPartialRow) void refreshTickets();
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

  // When voice or sound becomes available, play anything deferred (call before poll backup).
  useEffect(() => {
    drainDeferredAnnouncements();
  }, [voiceReady, audioUnlocked, drainDeferredAnnouncements]);

  // Backup path when poll refresh applies ticket changes (realtime handler is primary).
  useEffect(() => {
    if (typeof window === "undefined" || !voiceReady || !audioUnlocked) return;
    const pollPickOptions = {
      fromPoll: true as const,
      seededAtLoadIds: initialSeedTicketIdsRef.current,
    };
    for (const ticket of pickTicketsToAnnounce(
      tickets,
      lastTicketSnapshotRef.current,
      pollPickOptions,
    )) {
      announceTicketIfNeeded(ticket, undefined, { fromPoll: true });
    }
  }, [tickets, counterLabelById, labCounterId, imagingCounterId, voiceReady, audioUnlocked, announceTicketIfNeeded]);

  // Stop any in-flight announcement when the screen unmounts.
  useEffect(() => {
    return () => {
      cancelAnnouncement();
    };
  }, []);

  // Seed snapshot once so page load does not announce every ticket; do not reset on poll.
  const snapshotSeededRef = useRef(false);
  useEffect(() => {
    if (snapshotSeededRef.current) return;
    snapshotSeededRef.current = true;
    initialSeedTicketIdsRef.current = new Set(initialTickets.map((t) => t.id));
    for (const t of initialTickets) {
      lastTicketSnapshotRef.current.set(t.id, ticketSnapshotFromTicket(t));
    }
  }, [initialTickets]);

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

  const voicePhaseLabel =
    voiceBootStatus === "loading" && voiceBootPhase
      ? PIPER_BOOT_PHASE_LABELS[voiceBootPhase]
      : null;

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
      {voiceReady && !audioUnlocked ? (
        <EnableSoundBar
          onEnable={async () => {
            const ok = await unlockAnnouncementAudio();
            if (ok) {
              setAudioUnlocked(true);
              flushPendingAnnouncements();
              drainDeferredAnnouncements();
            }
          }}
        />
      ) : null}
      <StatusBar
        trailing={
          <VoiceAgentDock
            voiceReady={voiceReady}
            status={voiceBootStatus}
            progress={voiceBootProgress}
            phaseLabel={voicePhaseLabel}
            errorDetail={voiceBootError}
            activeVoice={activeVoice}
            onVoiceChange={handleVoiceChange}
            onRetry={retryVoiceBoot}
            onTestVoice={handleTestVoice}
            volume={voiceVolume}
            onVolumeChange={handleVolumeChange}
            echo={voiceEcho}
            onEchoChange={handleEchoChange}
          />
        }
      />
      <div
        style={{
          padding: "12px 20px 16px",
          minHeight: 0,
          height: "100%",
        }}
      >
        <QueueBoard cards={cards} />
      </div>
    </div>
  );
}
