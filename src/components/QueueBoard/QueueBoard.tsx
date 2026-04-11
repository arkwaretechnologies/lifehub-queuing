"use client";

import type { QueueCardModel } from "@/queue/types";
import { QueueCard } from "@/components/QueueBoard/QueueCard";

export function QueueBoard({ cards }: { cards: QueueCardModel[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
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

