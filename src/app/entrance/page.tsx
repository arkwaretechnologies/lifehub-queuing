"use client";

import { Button, Modal, Typography, message } from "antd";
import { IdcardOutlined, SafetyCertificateOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { PrinterSettings } from "@/config/types";
import {
  isBluetoothSupported,
  pairPrinter,
  printTicket as btPrintTicket,
  startAutoReconnect,
  subscribeConnectionState,
  warmupBluetoothConnection,
  type BluetoothConnectionState,
} from "@/print/bluetoothPrinter";

type Counter = { id: string; code: string; name: string; description: string | null };
type Priority = { id: number; code: string; name: string; level: number };
type IssuedTicket = {
  id: string;
  queue_display?: string;
  issued_at?: string;
  ticket_date?: string;
};

const FALLBACK_COUNTER_CODE = "RECEPTION";
const FALLBACK_REGULAR_PRIORITY_CODE = "REG";
const FALLBACK_PRIORITY_PRIORITY_CODE = "PRI";

const PRINTER_FALLBACK: PrinterSettings = {
  id: "default",
  clinic_name: "Lifehub Medical & Diagnostic Center",
  header_text: "Entrance Queue",
  footer_text: "Please wait for your number to be called.",
  paper_width_mm: 58,
  margin_mm: 4,
  show_logo: true,
  auto_print: true,
  auto_print_delay_ms: 250,
  font_size_number: 40,
  printer_name: null,
  printer_id: null,
  updated_at: "",
};

export default function EntrancePage() {
  const [issuing, setIssuing] = useState<"REG" | "PRI" | null>(null);
  const [msgApi, contextHolder] = message.useMessage();
  const [configLoading, setConfigLoading] = useState(true);
  const [printerErrorOpen, setPrinterErrorOpen] = useState(false);
  const [printerErrorText, setPrinterErrorText] = useState<string>("");
  const [repairing, setRepairing] = useState(false);

  const [counterCode, setCounterCode] = useState<string>(FALLBACK_COUNTER_CODE);
  const [regularPriorityCode, setRegularPriorityCode] = useState<string>(FALLBACK_REGULAR_PRIORITY_CODE);
  const [priorityPriorityCode, setPriorityPriorityCode] = useState<string>(FALLBACK_PRIORITY_PRIORITY_CODE);
  const [printerCfg, setPrinterCfg] = useState<PrinterSettings>(PRINTER_FALLBACK);
  const [bleState, setBleState] = useState<BluetoothConnectionState>("idle");
  const [bleError, setBleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [countersRes, prioritiesRes, printerRes] = await Promise.all([
          fetch("/api/config/counters"),
          fetch("/api/config/priorities"),
          fetch("/api/config/printer"),
        ]);

        const counters = (countersRes.ok ? ((await countersRes.json()) as Counter[]) : []) ?? [];
        const priorities = (prioritiesRes.ok ? ((await prioritiesRes.json()) as Priority[]) : []) ?? [];
        if (printerRes.ok) {
          const printerData = (await printerRes.json()) as Partial<PrinterSettings>;
          if (!cancelled) setPrinterCfg({ ...PRINTER_FALLBACK, ...printerData });
        }

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
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeConnectionState((state, error) => {
      setBleState(state);
      setBleError(error);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (configLoading) return;
    const teardown = startAutoReconnect({
      printer_id: printerCfg.printer_id,
      printer_name: printerCfg.printer_name,
    });
    return teardown;
  }, [configLoading, printerCfg.printer_id, printerCfg.printer_name]);

  // Manual retry of background reconnect (used by status pill click).
  const retryReconnect = useMemo(
    () => () =>
      void warmupBluetoothConnection({
        printer_id: printerCfg.printer_id,
        printer_name: printerCfg.printer_name,
      }),
    [printerCfg.printer_id, printerCfg.printer_name],
  );

  const debugHint = useMemo(() => {
    return `${counterCode} • ${regularPriorityCode} • ${priorityPriorityCode}`;
  }, [counterCode, regularPriorityCode, priorityPriorityCode]);

  async function savePairedPrinter(name: string, id: string) {
    let updated = { ...printerCfg, printer_name: name, printer_id: id } as PrinterSettings;
    try {
      const res = await fetch("/api/config/printer", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ printer_name: name, printer_id: id }),
      });
      if (res.ok) {
        updated = { ...PRINTER_FALLBACK, ...((await res.json()) as Partial<PrinterSettings>) };
      } else {
        // Backward-compat fallback if DB schema hasn't been migrated yet.
        const legacy = await fetch("/api/config/printer", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ printer_name: name }),
        });
        if (legacy.ok) {
          updated = { ...PRINTER_FALLBACK, ...((await legacy.json()) as Partial<PrinterSettings>) };
        }
      }
    } catch {
      // Keep local state update even if persistence fails.
    }
    setPrinterCfg(updated);
  }

  async function issue(priorityCode: "REG" | "PRI") {
    if (issuing || configLoading) return;
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
      const ticket = (await res.json()) as IssuedTicket;
      const ticketId = ticket?.id;
      if (!ticketId) {
        msgApi.error("Ticket issued but no id returned");
        return;
      }

      const hasPairedPrinter = !!(printerCfg.printer_id || printerCfg.printer_name);
      if (!isBluetoothSupported()) {
        setPrinterErrorText("This browser does not support Bluetooth printing on kiosk mode.");
        setPrinterErrorOpen(true);
        return;
      }
      if (!hasPairedPrinter) {
        setPrinterErrorText("No paired Bluetooth printer is configured. Please pair a printer.");
        setPrinterErrorOpen(true);
        return;
      }

      // If a background reconnect is mid-flight, give it a brief window to
      // settle so the very first tap after a page reload doesn't race the
      // fresh GATT handshake.
      if (bleState === "connecting") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const result = await btPrintTicket(
        { printer_id: printerCfg.printer_id, printer_name: printerCfg.printer_name },
        {
          queue_display: ticket.queue_display ?? "—",
          issued_at: ticket.issued_at,
          ticket_date: ticket.ticket_date,
        },
        printerCfg,
      );
      if (result.ok) {
        msgApi.success(`Printing ${ticket.queue_display ?? "ticket"}`);
        return;
      }

      setPrinterErrorText(result.error);
      setPrinterErrorOpen(true);
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
      <Modal
        open={printerErrorOpen}
        title="Bluetooth printer not available"
        closable={!repairing}
        mask={{ closable: !repairing }}
        onCancel={() => {
          if (!repairing) setPrinterErrorOpen(false);
        }}
        footer={[
          <Button key="close" onClick={() => setPrinterErrorOpen(false)} disabled={repairing}>
            Close
          </Button>,
          <Button
            key="repair"
            type="primary"
            loading={repairing}
            onClick={async () => {
              setRepairing(true);
              try {
                const paired = await pairPrinter();
                await savePairedPrinter(paired.name, paired.id);
                const warmup = await warmupBluetoothConnection({
                  printer_id: paired.id,
                  printer_name: paired.name,
                });
                if (warmup.ok) {
                  msgApi.success(`Re-paired printer: ${paired.name}`);
                  setPrinterErrorOpen(false);
                } else {
                  msgApi.error(`Re-paired but cannot reconnect yet: ${warmup.error}`);
                }
              } catch (e) {
                const text = e instanceof Error ? e.message : "Pairing failed";
                msgApi.error(text);
              } finally {
                setRepairing(false);
              }
            }}
          >
            Re-pair printer
          </Button>,
        ]}
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {printerErrorText || "The saved Bluetooth printer could not be reached."}
        </Typography.Paragraph>
      </Modal>

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
          onClick={issuing || configLoading ? undefined : () => issue("REG")}
          disabled={configLoading || (!!issuing && issuing !== "REG")}
          style={{
            flex: "1 1 380px",
            maxWidth: 440,
            minHeight: 280,
            border: "none",
            borderRadius: 28,
            cursor: issuing || configLoading ? "not-allowed" : "pointer",
            opacity: configLoading || (issuing && issuing !== "REG") ? 0.5 : 1,
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
            {configLoading ? "Loading…" : issuing === "REG" ? "Printing…" : "Tap to get your number"}
          </span>
        </button>

        {/* Priority */}
        <button
          type="button"
          onClick={issuing || configLoading ? undefined : () => issue("PRI")}
          disabled={configLoading || (!!issuing && issuing !== "PRI")}
          style={{
            flex: "1 1 380px",
            maxWidth: 440,
            minHeight: 280,
            border: "none",
            borderRadius: 28,
            cursor: issuing || configLoading ? "not-allowed" : "pointer",
            opacity: configLoading || (issuing && issuing !== "PRI") ? 0.5 : 1,
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
            {configLoading ? "Loading…" : issuing === "PRI" ? "Printing…" : "Senior / PWD / Pregnant"}
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

      {/* Printer connection status */}
      {(printerCfg.printer_id || printerCfg.printer_name) && (
        <button
          type="button"
          onClick={retryReconnect}
          title={bleError ?? undefined}
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(0,0,0,0.08)",
            fontSize: 12,
            color: "#374151",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                bleState === "connected"
                  ? "#10b981"
                  : bleState === "connecting"
                    ? "#f59e0b"
                    : bleState === "error"
                      ? "#ef4444"
                      : "#9ca3af",
              boxShadow: bleState === "connecting" ? "0 0 0 4px rgba(245, 158, 11, 0.18)" : "none",
              transition: "background 0.2s ease",
            }}
          />
          {bleState === "connected"
            ? "Printer ready"
            : bleState === "connecting"
              ? "Connecting printer…"
              : bleState === "error"
                ? "Printer offline — tap to retry"
                : bleState === "unpaired"
                  ? "Printer not paired"
                  : "Printer idle"}
        </button>
      )}

      {/* Footer */}
      <div style={{ marginTop: 32, textAlign: "center", color: "#9ca3af", fontSize: 11 }}>
        Lifehub Medical & Diagnostic Center • {debugHint}
      </div>
    </div>
  );
}
