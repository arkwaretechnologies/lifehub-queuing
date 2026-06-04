"use client";

import type { QueueCardModel } from "@/queue/types";
import { QueueCard } from "@/components/QueueBoard/QueueCard";

type CardPlacement = {
  card: QueueCardModel;
  gridColumn: string;
};

/** 6-column grid: 3 cards per row (span 2); a partial last row expands to fill the row. */
function buildCardPlacements(cards: QueueCardModel[]): CardPlacement[] {
  const placements: CardPlacement[] = [];
  let i = 0;

  while (i < cards.length) {
    const remaining = cards.length - i;
    const rowSize = remaining >= 3 ? 3 : remaining;

    if (rowSize === 3) {
      for (let j = 0; j < 3; j++) {
        placements.push({ card: cards[i + j], gridColumn: "span 2" });
      }
      i += 3;
    } else if (rowSize === 2) {
      placements.push({ card: cards[i], gridColumn: "span 3" });
      placements.push({ card: cards[i + 1], gridColumn: "span 3" });
      i += 2;
    } else {
      placements.push({ card: cards[i], gridColumn: "span 6" });
      i += 1;
    }
  }

  return placements;
}

export function QueueBoard({ cards }: { cards: QueueCardModel[] }) {
  if (cards.length <= 2) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gridTemplateRows: cards.length === 1 ? "1fr" : "1fr 1fr",
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

  const placements = buildCardPlacements(cards);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gridAutoRows: "1fr",
        gap: 12,
        height: "100%",
      }}
    >
      {placements.map(({ card, gridColumn }) => (
        <div key={card.title} style={{ gridColumn, minHeight: 0, height: "100%" }}>
          <QueueCard model={card} />
        </div>
      ))}
    </div>
  );
}
