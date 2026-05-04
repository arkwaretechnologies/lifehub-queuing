"use client";

import type { PrinterSettings } from "@/config/types";

export type TicketLike = {
  queue_display: string;
  issued_at?: string | null;
  ticket_date?: string | null;
};

// Common BLE services used by many thermal printers
const SERVICE_UUIDS: BluetoothServiceUUID[] = [
  0x18f0, // many generic BLE thermal printers
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // common thermal service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // common UART-like service
];

function textEncoder() {
  return new TextEncoder();
}

function escPosInit(): number[] {
  return [0x1b, 0x40]; // ESC @
}

function escPosAlign(align: "left" | "center" | "right"): number[] {
  // ESC a n
  const n = align === "left" ? 0 : align === "center" ? 1 : 2;
  return [0x1b, 0x61, n];
}

function escPosBold(on: boolean): number[] {
  return [0x1b, 0x45, on ? 1 : 0];
}

function escPosDoubleSize(on: boolean): number[] {
  // GS ! n (rough: 0x11 is 2x width+height)
  return [0x1d, 0x21, on ? 0x11 : 0x00];
}

function escPosFeed(lines: number): number[] {
  return [0x1b, 0x64, Math.max(0, Math.min(255, lines))]; // ESC d n
}

function escPosCut(): number[] {
  // GS V 66 0 => partial cut (common)
  return [0x1d, 0x56, 0x42, 0x00];
}

function escPosHr(): number[] {
  const enc = textEncoder();
  return Array.from(enc.encode("--------------------------------\n"));
}

function escPosText(s: string): number[] {
  const enc = textEncoder();
  return Array.from(enc.encode(s));
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

export async function pairPrinter(): Promise<string> {
  if (!isBluetoothSupported()) throw new Error("Bluetooth not supported");

  // Must be called from a user gesture (button click)
  const device = await navigator.bluetooth.requestDevice({
    // Use optionalServices so we can later enumerate services/characteristics
    acceptAllDevices: true,
    optionalServices: SERVICE_UUIDS,
  });

  if (!device.name) return "Bluetooth Printer";
  return device.name;
}

async function findWritableCharacteristic(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
  // Try known services first
  for (const uuid of SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      const writable = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
      if (writable) return writable;
    } catch {
      // ignore and continue
    }
  }

  // Fallback: scan all primary services (can be slower)
  const services = await server.getPrimaryServices();
  for (const svc of services) {
    const chars = await svc.getCharacteristics();
    const writable = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
    if (writable) return writable;
  }

  throw new Error("No writable characteristic found");
}

function chunkBytes(bytes: Uint8Array, chunkSize = 180): Uint8Array[] {
  // Many printers are picky about write sizes; keep chunks small.
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out.push(bytes.slice(i, i + chunkSize));
  }
  return out;
}

export function buildTicketBytes(ticket: TicketLike, settings: PrinterSettings): Uint8Array {
  const b: number[] = [];

  b.push(...escPosInit());
  b.push(...escPosAlign("center"));
  b.push(...escPosBold(true));
  b.push(...escPosText(`${settings.clinic_name}\n`));
  b.push(...escPosBold(false));

  if (settings.header_text) {
    b.push(...escPosText(`${settings.header_text}\n`));
  }

  b.push(...escPosFeed(1));
  b.push(...escPosDoubleSize(true));
  b.push(...escPosBold(true));
  b.push(...escPosText(`${ticket.queue_display || "—"}\n`));
  b.push(...escPosBold(false));
  b.push(...escPosDoubleSize(false));

  const dateLine = [ticket.ticket_date, ticket.issued_at ? new Date(ticket.issued_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null]
    .filter(Boolean)
    .join(" ");
  if (dateLine) {
    b.push(...escPosText(`${dateLine}\n`));
  }

  if (settings.footer_text) {
    b.push(...escPosFeed(1));
    b.push(...escPosHr());
    b.push(...escPosText(`${settings.footer_text}\n`));
  }

  b.push(...escPosFeed(3));
  b.push(...escPosCut());
  return new Uint8Array(b);
}

export async function printTicket(
  deviceName: string,
  ticket: TicketLike,
  settings: PrinterSettings,
): Promise<boolean> {
  if (!isBluetoothSupported()) return false;
  if (!deviceName) return false;

  try {
    // Get devices previously granted permission (no user gesture required)
    const devices = await navigator.bluetooth.getDevices();
    const device = devices.find((d) => d.name === deviceName) ?? null;
    if (!device) return false;

    const server = await device.gatt?.connect();
    if (!server) return false;

    const ch = await findWritableCharacteristic(server);
    const bytes = buildTicketBytes(ticket, settings);
    const chunks = chunkBytes(bytes);

    for (const part of chunks) {
      const buf = part as BufferSource;
      if (ch.properties.writeWithoutResponse) {
        await ch.writeValueWithoutResponse(buf);
      } else {
        await ch.writeValue(buf);
      }
    }

    try {
      server.disconnect();
    } catch {
      // ignore
    }

    return true;
  } catch {
    return false;
  }
}

export async function testPrint(deviceName: string, settings: PrinterSettings): Promise<boolean> {
  const now = new Date();
  return printTicket(
    deviceName,
    {
      queue_display: "TEST",
      issued_at: now.toISOString(),
      ticket_date: now.toLocaleDateString(),
    },
    settings,
  );
}

