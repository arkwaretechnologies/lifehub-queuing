"use client";

import type { QueueCardModel } from "@/queue/types";
import { QueueCard } from "@/components/QueueBoard/QueueCard";

function gridColumns(count: number): string {
  if (count <= 2) return "1fr";
  if (count <= 4) return "1fr 1fr";
  if (count <= 6) return "1fr 1fr 1fr";
  return "1fr 1fr 1fr 1fr";
}

function gridRows(count: number): string {
  if (count <= 1) return "1fr";
  if (count <= 3) return "1fr 1fr";
  if (count <= 6) return "1fr 1fr";
  return "1fr 1fr";
}

export function QueueBoard({ cards }: { cards: QueueCardModel[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: gridColumns(cards.length),
        gridTemplateRows: gridRows(cards.length),
        gap: 12,
        height: "100%",
      }}
    >
      {cards.map((c) => (
        <QueueCard key={c.title} model={c} />
      ))}
    </div>
  );
}
