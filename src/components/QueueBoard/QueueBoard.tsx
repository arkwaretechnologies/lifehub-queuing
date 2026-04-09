"use client";

import { Row, Col } from "antd";
import type { QueueCardModel } from "@/queue/types";
import { QueueCard } from "@/components/QueueBoard/QueueCard";

export function QueueBoard({ cards }: { cards: QueueCardModel[] }) {
  return (
    <Row gutter={[16, 16]} style={{ height: "100%" }}>
      {cards.map((c) => (
        <Col key={c.title} span={12} style={{ height: "50%" }}>
          <div style={{ height: "100%" }}>
            <QueueCard model={c} />
          </div>
        </Col>
      ))}
    </Row>
  );
}

