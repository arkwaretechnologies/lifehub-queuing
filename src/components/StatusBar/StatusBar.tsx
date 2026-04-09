"use client";

import { Badge, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

export function StatusBar({
  facilityName = "Lifehub",
  connected,
  screenId,
}: {
  facilityName?: string;
  connected: boolean;
  screenId: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeText = useMemo(
    () =>
      now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [now],
  );

  const dateText = useMemo(
    () =>
      now.toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    [now],
  );

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "10px 14px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.03)",
      }}
    >
      <Space size={10} align="start">
        <Image
          src="/lifehub-logo.png"
          alt="Lifehub"
          width={34}
          height={34}
          priority
          style={{ borderRadius: 8 }}
        />
        <Space orientation="vertical" size={0}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            {facilityName}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Screen: {screenId}
          </Typography.Text>
        </Space>
      </Space>

      <Space align="end" size={16}>
        <Space orientation="vertical" size={0} style={{ textAlign: "right" }}>
          <Typography.Text strong style={{ fontSize: 18 }}>
            {timeText}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dateText}
          </Typography.Text>
        </Space>
        <Badge status={connected ? "success" : "error"} text={connected ? "Live" : "Offline"} />
      </Space>
    </div>
  );
}

