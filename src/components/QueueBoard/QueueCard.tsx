"use client";

import { Card, Divider, Space, Tag, Typography } from "antd";
import type { QueueCardModel } from "@/queue/types";

const accentToColor: Record<QueueCardModel["accent"], string> = {
  blue: "#1677ff",
  green: "#52c41a",
  gold: "#faad14",
  purple: "#722ed1",
};

export function QueueCard({ model }: { model: QueueCardModel }) {
  const accent = accentToColor[model.accent];

  return (
    <Card
      styles={{
        header: { borderBottom: "none" },
        body: { paddingTop: 8 },
      }}
      title={
        <Space size={10}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: accent,
              boxShadow: `0 0 0 4px ${accent}22`,
            }}
          />
          <Space orientation="vertical" size={0}>
            <Typography.Text strong style={{ fontSize: 16 }}>
              {model.title}
            </Typography.Text>
            {model.subtitle ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {model.subtitle}
              </Typography.Text>
            ) : null}
          </Space>
        </Space>
      }
    >
      <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr", gap: 10, height: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            NOW SERVING
          </Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Next: {model.nextUp.length}
          </Typography.Text>
        </div>

        <div style={{ lineHeight: 1 }}>
          <Typography.Text
            style={{
              fontSize: 46,
              fontWeight: 800,
              letterSpacing: 1,
              color: model.nowServing ? "inherit" : "rgba(0,0,0,0.35)",
            }}
          >
            {model.nowServing ?? "—"}
          </Typography.Text>
        </div>

        <div style={{ minHeight: 0 }}>
          <Divider style={{ margin: "8px 0" }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            NEXT UP
          </Typography.Text>
          <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
            {model.nextUp.length ? (
              model.nextUp.map((item) => (
                <div
                  key={item}
                  style={{
                    padding: "6px 0",
                    borderBottom: "1px solid rgba(5, 5, 5, 0.06)",
                  }}
                >
                  <Typography.Text style={{ fontSize: 16, fontWeight: 600 }}>{item}</Typography.Text>
                </div>
              ))
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                —
              </Typography.Text>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

