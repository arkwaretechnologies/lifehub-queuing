"use client";

import { Layout, Row, Col } from "antd";
import { useEffect, useMemo, useState } from "react";
import type { MediaPlaylistItem, QueueScreen } from "@/config/types";
import type { QueueTicket } from "@/queue/types";
import { QueueBoard } from "@/components/QueueBoard/QueueBoard";
import { StatusBar } from "@/components/StatusBar/StatusBar";
import { MediaPanel } from "@/components/MediaPanel/MediaPanel";
import { buildQueueCard } from "@/queue/buildCards";
import { supabaseBrowser } from "@/db/supabaseBrowser";

type Counter = { id: string; code: string; name: string; description: string | null };
type Priority = { id: number; code: string; name: string; level: number };
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
};

export function QueueScreenClient({
  screenId,
  screen,
  counters,
  priorities,
  initialTickets,
  playlistItems,
  playlistLoop,
}: {
  screenId: string;
  screen: QueueScreen | null;
  counters: Counter[];
  priorities: Priority[];
  initialTickets: QueueTicket[];
  playlistItems: MediaPlaylistItem[];
  playlistLoop: boolean;
}) {
  const [connected, setConnected] = useState(false);
  const [tickets, setTickets] = useState<QueueTicket[]>(initialTickets);

  const counterIdByCode = useMemo(() => {
    const m = new Map<string, string>();
    counters.forEach((c) => m.set(c.code, c.id));
    return m;
  }, [counters]);

  const priorityIdByCode = useMemo(() => {
    const m = new Map<string, number>();
    priorities.forEach((p) => m.set(p.code, p.id));
    return m;
  }, [priorities]);

  const counterIdsToWatch = useMemo(() => {
    const codes = new Set<string>(screen?.counter_codes ?? []);
    if (screen?.entrance_counter_code) codes.add(screen.entrance_counter_code);
    const ids: string[] = [];
    for (const code of codes) {
      const id = counterIdByCode.get(code);
      if (id) ids.push(id);
    }
    return ids;
  }, [screen, counterIdByCode]);

  useEffect(() => {
    if (!counterIdsToWatch.length) return;
    let cancelled = false;
    const supabase = supabaseBrowser();

    const channel = supabase
      .channel(`queue_tickets_${screenId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_tickets" },
        (payload) => {
          if (cancelled) return;
          setConnected(true);

          const row = (payload.new || payload.old) as unknown as Partial<QueueTicketRow> | null;
          const rowCounterId = row?.counter_id ? String(row.counter_id) : null;
          if (!rowCounterId) return;
          if (!counterIdsToWatch.includes(rowCounterId)) return;

          setTickets((prev) => {
            const next = prev.slice();
            const rowId = row?.id ? String(row.id) : "";
            if (!rowId) return next;
            const idx = next.findIndex((t) => t.id === rowId);
            const mapped: QueueTicket = {
              id: rowId,
              counter_id: rowCounterId,
              priority_id: Number(row.priority_id),
              queue_number: Number(row.queue_number),
              queue_display: String(row.queue_display),
              ticket_date: String(row.ticket_date),
              status: row.status,
              issued_at: String(row.issued_at),
              called_at: row.called_at ? String(row.called_at) : null,
              serving_at: row.serving_at ? String(row.serving_at) : null,
            };
            if (payload.eventType === "DELETE") {
              if (idx >= 0) next.splice(idx, 1);
              return next;
            }
            if (idx >= 0) next[idx] = mapped;
            else next.push(mapped);
            return next;
          });
        },
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

  const cards = useMemo(() => {
    const byCounterId = new Map<string, QueueTicket[]>();
    tickets.forEach((t) => {
      const arr = byCounterId.get(t.counter_id) ?? [];
      arr.push(t);
      byCounterId.set(t.counter_id, arr);
    });

    const entranceCode = screen?.entrance_counter_code ?? null;
    const entranceCounterId = entranceCode ? counterIdByCode.get(entranceCode) ?? null : null;
    const entranceTickets = entranceCounterId ? byCounterId.get(entranceCounterId) ?? [] : [];
    const regularCode = screen?.entrance_regular_priority_code ?? null;
    const priorityCode = screen?.entrance_priority_priority_code ?? null;
    const regularId = regularCode ? priorityIdByCode.get(regularCode) ?? null : null;
    const priorityId = priorityCode ? priorityIdByCode.get(priorityCode) ?? null : null;

    const entranceRegular = regularId ? entranceTickets.filter((t) => t.priority_id === regularId) : [];
    const entrancePriority = priorityId ? entranceTickets.filter((t) => t.priority_id === priorityId) : [];

    const configuredCounterCodes = screen?.counter_codes ?? [];
    const other = configuredCounterCodes
      .map((code) => {
        const id = counterIdByCode.get(code);
        if (!id) return null;
        const meta = counters.find((c) => c.code === code);
        return {
          code,
          title: meta?.name ?? code,
          subtitle: meta?.description ?? undefined,
          tickets: byCounterId.get(id) ?? [],
        };
      })
      .filter(Boolean) as { code: string; title: string; subtitle?: string; tickets: QueueTicket[] }[];

    // Build exactly 4 cards for the TV: Entrance (split), Lab, Dr Mark, Dr Ralph.
    // If admin config provides only 3 counters, we’ll still render 4 cards with placeholders.
    const entranceCard = {
      title: "Entrance",
      subtitle: "Registration Queue",
      accent: "blue" as const,
      tickets: [...entrancePriority, ...entranceRegular],
      nextLimit: 6,
    };
    const lab = other[0]
      ? { ...other[0], accent: "green" as const }
      : { title: "Laboratory", subtitle: "Collection", tickets: [], accent: "green" as const };
    const drMark = other[1]
      ? { ...other[1], accent: "gold" as const }
      : { title: "Dr. Mark", subtitle: "Doctor", tickets: [], accent: "gold" as const };
    const drRalph = other[2]
      ? { ...other[2], accent: "purple" as const }
      : { title: "Dr. Ralph", subtitle: "Doctor", tickets: [], accent: "purple" as const };

    return [
      buildQueueCard(entranceCard),
      buildQueueCard({ title: lab.title, subtitle: lab.subtitle, accent: lab.accent, tickets: lab.tickets }),
      buildQueueCard({
        title: drMark.title,
        subtitle: drMark.subtitle,
        accent: drMark.accent,
        tickets: drMark.tickets,
      }),
      buildQueueCard({
        title: drRalph.title,
        subtitle: drRalph.subtitle,
        accent: drRalph.accent,
        tickets: drRalph.tickets,
      }),
    ];
  }, [tickets, screen, counters, counterIdByCode, priorityIdByCode]);

  return (
    <Layout style={{ height: "100vh" }}>
      <Layout.Content style={{ padding: 16 }}>
        <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 12 }}>
          <StatusBar connected={connected} screenId={screenId} />
          <Row gutter={16} style={{ height: "100%" }}>
            <Col span={14} style={{ height: "100%" }}>
              <QueueBoard cards={cards} />
            </Col>
            <Col span={10} style={{ height: "100%" }}>
              <MediaPanel items={playlistItems} loop={playlistLoop} />
            </Col>
          </Row>
        </div>
      </Layout.Content>
    </Layout>
  );
}

