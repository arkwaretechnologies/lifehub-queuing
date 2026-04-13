"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrinterSettings } from "@/config/types";
import { printTicket as btPrintTicket } from "@/print/bluetoothPrinter";

type Ticket = {
  id: string;
  queue_display: string;
  issued_at: string;
  ticket_date: string;
};

const FALLBACK: PrinterSettings = {
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
  updated_at: "",
};

export default function PrintTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [cfg, setCfg] = useState<PrinterSettings>(FALLBACK);

  useEffect(() => {
    params.then((p) => setTicketId(p.ticketId));
  }, [params]);

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    (async () => {
      const [ticketRes, cfgRes] = await Promise.all([
        fetch(`/api/print/ticket/${ticketId}`),
        fetch("/api/config/printer"),
      ]);
      if (cancelled) return;
      if (ticketRes.ok) setTicket(await ticketRes.json());
      if (cfgRes.ok) {
        const data = await cfgRes.json();
        setCfg({ ...FALLBACK, ...data });
      }
    })();
    return () => { cancelled = true; };
  }, [ticketId]);

  const timeText = (() => {
    if (!ticket?.issued_at) return "";
    try {
      return new Date(ticket.issued_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  })();

  const trySilentPrint = useCallback(async () => {
    if (!cfg.printer_name) {
      window.print();
      return;
    }
    const ok = await btPrintTicket(
      cfg.printer_name,
      {
        queue_display: ticket?.queue_display ?? "—",
        issued_at: ticket?.issued_at,
        ticket_date: ticket?.ticket_date,
      },
      cfg,
    );
    if (!ok) window.print();
  }, [cfg.printer_name, ticket?.issued_at, ticket?.queue_display, ticket?.ticket_date, cfg]);

  useEffect(() => {
    if (!ticket || !cfg.auto_print) return;
    const t = setTimeout(() => trySilentPrint(), cfg.auto_print_delay_ms);
    return () => clearTimeout(t);
  }, [ticket, cfg.auto_print, cfg.auto_print_delay_ms, trySilentPrint]);

  return (
    <div
      style={{
        padding: `${cfg.margin_mm}mm`,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        color: "#000",
      }}
    >
      <style>{`
        @page { size: ${cfg.paper_width_mm}mm auto; margin: ${cfg.margin_mm}mm; }
        @media print {
          body { background: #fff !important; }
        }
      `}</style>

      <div style={{ textAlign: "center" }}>
        {cfg.show_logo && (
          <div style={{ marginBottom: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lifehub-logo.png"
              alt=""
              style={{ width: 32, height: 32, borderRadius: 4 }}
            />
          </div>
        )}
        {cfg.clinic_name && (
          <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 2, lineHeight: 1.2 }}>
            {cfg.clinic_name}
          </div>
        )}
        {cfg.header_text && (
          <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>
            {cfg.header_text}
          </div>
        )}
        <div
          style={{
            fontSize: cfg.font_size_number,
            fontWeight: 800,
            letterSpacing: 1,
            lineHeight: 1.1,
            margin: "4px 0",
          }}
        >
          {ticket?.queue_display ?? "—"}
        </div>
        <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>
          {ticket?.ticket_date ?? ""} {timeText}
        </div>
        {cfg.footer_text && (
          <>
            <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }} />
            <div style={{ fontSize: 8, color: "#999", lineHeight: 1.3 }}>
              {cfg.footer_text}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
