"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

const DEFAULT_FACILITY_NAME = "LIFEHUB MEDICAL AND DIAGNOSTIC CENTER";

export function StatusBar({
  facilityName = DEFAULT_FACILITY_NAME,
  connected,
  screenId: _screenId,
}: {
  facilityName?: string;
  connected: boolean;
  screenId: string;
}) {
  // null until mount: avoids hydration mismatch (server time ≠ client time / locale).
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeText = useMemo(() => {
    if (!now) return "--:--:--";
    return now.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [now]);

  const dateText = useMemo(() => {
    if (!now) return "\u00a0";
    return now.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [now]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 20px",
        minHeight: 52,
        background: "linear-gradient(180deg, rgba(15,22,40,0.95) 0%, rgba(10,15,26,0.9) 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <Image
        src="/lifehub-logo.png"
        alt="Lifehub"
        width={40}
        height={40}
        priority
        style={{ borderRadius: 8, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
        <div
          style={{
            fontSize: "clamp(0.7rem, 1.15vw + 0.55rem, 1.5rem)",
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.15,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {facilityName}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, flexShrink: 0 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: 1, fontVariantNumeric: "tabular-nums" }}>
            {timeText}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 0.3, minHeight: "1.2em" }}>
            {dateText}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 20,
            background: connected ? "rgba(82,196,26,0.12)" : "rgba(255,77,79,0.12)",
            border: `1px solid ${connected ? "rgba(82,196,26,0.25)" : "rgba(255,77,79,0.25)"}`,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: connected ? "#52c41a" : "#ff4d4f",
              boxShadow: `0 0 6px ${connected ? "#52c41a" : "#ff4d4f"}`,
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: connected ? "#52c41a" : "#ff4d4f", letterSpacing: 0.5 }}>
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>
    </div>
  );
}

