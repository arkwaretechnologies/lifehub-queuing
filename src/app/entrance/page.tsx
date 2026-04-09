"use client";

import { Typography, message } from "antd";
import { IdcardOutlined, SafetyCertificateOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Counter = { id: string; code: string; name: string; description: string | null };
type Priority = { id: number; code: string; name: string; level: number };

const FALLBACK_COUNTER_CODE = "RECEPTION";
const FALLBACK_REGULAR_PRIORITY_CODE = "REG";
const FALLBACK_PRIORITY_PRIORITY_CODE = "PRI";

export default function EntrancePage() {
  const [issuing, setIssuing] = useState<"REG" | "PRI" | null>(null);
  const [msgApi, contextHolder] = message.useMessage();

  const [counterCode, setCounterCode] = useState<string>(FALLBACK_COUNTER_CODE);
  const [regularPriorityCode, setRegularPriorityCode] = useState<string>(FALLBACK_REGULAR_PRIORITY_CODE);
  const [priorityPriorityCode, setPriorityPriorityCode] = useState<string>(FALLBACK_PRIORITY_PRIORITY_CODE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [countersRes, prioritiesRes] = await Promise.all([
          fetch("/api/config/counters"),
          fetch("/api/config/priorities"),
        ]);

        const counters = (countersRes.ok ? ((await countersRes.json()) as Counter[]) : []) ?? [];
        const priorities = (prioritiesRes.ok ? ((await prioritiesRes.json()) as Priority[]) : []) ?? [];

        if (cancelled) return;

        const preferredCounter =
          counters.find((c) => c.code.toUpperCase() === "RECEPTION") ??
          counters.find((c) => c.code.toUpperCase() === "ENTRANCE") ??
          counters[0] ??
          null;
        if (preferredCounter) setCounterCode(preferredCounter.code);

        const reg =
          priorities.find((p) => /^(REG|REGULAR)$/i.test(p.code)) ??
          priorities.find((p) => /\bregular\b/i.test(p.name)) ??
          null;
        const pri =
          priorities.find((p) => /^(PRI|PRIORITY)$/i.test(p.code)) ??
          priorities.find((p) => /\bpriority\b/i.test(p.name)) ??
          null;

        if (reg) setRegularPriorityCode(reg.code);
        if (pri) setPriorityPriorityCode(pri.code);

        if (!reg && priorities.length) {
          const byHigh = [...priorities].sort((a, b) => b.level - a.level)[0];
          if (byHigh) setRegularPriorityCode(byHigh.code);
        }
        if (!pri && priorities.length) {
          const byLow = [...priorities].sort((a, b) => a.level - b.level)[0];
          if (byLow) setPriorityPriorityCode(byLow.code);
        }
      } catch {
        // ignore and keep fallbacks
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const debugHint = useMemo(() => {
    return `${counterCode} • ${regularPriorityCode} • ${priorityPriorityCode}`;
  }, [counterCode, regularPriorityCode, priorityPriorityCode]);

  async function issue(priorityCode: "REG" | "PRI") {
    if (issuing) return;
    try {
      setIssuing(priorityCode);
      const res = await fetch("/api/entrance/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          counterCode,
          priorityCode: priorityCode === "REG" ? regularPriorityCode : priorityPriorityCode,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        msgApi.error(t || "Failed to issue ticket");
        return;
      }
      const ticket = await res.json();
      const ticketId = ticket?.id;
      if (!ticketId) {
        msgApi.error("Ticket issued but no id returned");
        return;
      }
      window.open(`/print/ticket/${ticketId}`, "_blank", "noopener,noreferrer");
    } finally {
      setIssuing(null);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #f8f1e9 0%, #eee8e0 50%, #e8e0d8 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        position: "relative",
      }}
    >
      {contextHolder}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <Image
          src="/lifehub-logo.png"
          alt="Lifehub Medical & Diagnostic Center"
          width={80}
          height={80}
          priority
          style={{ borderRadius: 16, marginBottom: 16 }}
        />
        <Typography.Title
          level={1}
          style={{
            margin: 0,
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: "-1px",
            color: "#1f2937",
            lineHeight: 1.1,
          }}
        >
          Get Your Queue Number
        </Typography.Title>
        <Typography.Paragraph
          style={{
            margin: "12px auto 0",
            fontSize: 20,
            color: "#6b7280",
            maxWidth: 500,
          }}
        >
          Tap your ticket type to print instantly
        </Typography.Paragraph>
      </div>

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          gap: 24,
          width: "min(900px, 100%)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {/* Regular */}
        <button
          type="button"
          onClick={issuing ? undefined : () => issue("REG")}
          disabled={!!issuing && issuing !== "REG"}
          style={{
            flex: "1 1 380px",
            maxWidth: 440,
            minHeight: 280,
            border: "none",
            borderRadius: 28,
            cursor: issuing ? "not-allowed" : "pointer",
            opacity: issuing && issuing !== "REG" ? 0.5 : 1,
            background: "linear-gradient(145deg, #3b82f6, #1d4ed8)",
            boxShadow: "0 12px 40px rgba(59, 130, 246, 0.35)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "40px 24px",
            transition: "all 0.2s ease",
            transform: issuing === "REG" ? "scale(0.97)" : "scale(1)",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: "rgba(255,255,255,0.2)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <IdcardOutlined style={{ fontSize: 44, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1 }}>
            Regular
          </span>
          <span style={{ fontSize: 16, opacity: 0.85, fontWeight: 500 }}>
            {issuing === "REG" ? "Printing…" : "Tap to get your number"}
          </span>
        </button>

        {/* Priority */}
        <button
          type="button"
          onClick={issuing ? undefined : () => issue("PRI")}
          disabled={!!issuing && issuing !== "PRI"}
          style={{
            flex: "1 1 380px",
            maxWidth: 440,
            minHeight: 280,
            border: "none",
            borderRadius: 28,
            cursor: issuing ? "not-allowed" : "pointer",
            opacity: issuing && issuing !== "PRI" ? 0.5 : 1,
            background: "linear-gradient(145deg, #f59e0b, #d97706)",
            boxShadow: "0 12px 40px rgba(245, 158, 11, 0.35)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "40px 24px",
            transition: "all 0.2s ease",
            transform: issuing === "PRI" ? "scale(0.97)" : "scale(1)",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: "rgba(255,255,255,0.2)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <SafetyCertificateOutlined style={{ fontSize: 44, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1 }}>
            Priority
          </span>
          <span style={{ fontSize: 16, opacity: 0.85, fontWeight: 500 }}>
            {issuing === "PRI" ? "Printing…" : "Senior / PWD / Pregnant"}
          </span>
        </button>
      </div>

      {/* Online appointment notice */}
      <div
        style={{
          marginTop: 48,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          maxWidth: 540,
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(8px)",
          borderRadius: 14,
          padding: "14px 20px",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <InfoCircleOutlined style={{ fontSize: 18, color: "#3b82f6", marginTop: 2, flexShrink: 0 }} />
        <div>
          <Typography.Text strong style={{ fontSize: 14, color: "#1f2937" }}>
            Have an online appointment?
          </Typography.Text>
          <Typography.Paragraph style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
            Please proceed directly to Reception for check-in. Do not take an Entrance ticket.
          </Typography.Paragraph>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 32, textAlign: "center", color: "#9ca3af", fontSize: 11 }}>
        Lifehub Medical & Diagnostic Center • {debugHint}
      </div>
    </div>
  );
}
