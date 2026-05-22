"use client";

import type { PrinterSettings } from "@/config/types";

export type TicketLike = {
  queue_display: string;
  issued_at?: string | null;
  ticket_date?: string | null;
};

export type PairedPrinter = {
  id: string;
  name: string;
};

export type PrintResult = { ok: true } | { ok: false; error: string };

export type PrinterTarget = {
  printer_id?: string | null;
  printer_name?: string | null;
};

// Broad list of services seen on common 58mm/80mm BLE thermal printers.
// `optionalServices` acts as the allow-list for getPrimaryService(s); without
// the actual UUID listed here the printer's service is invisible to us, even
// in the fallback "scan all primary services" loop.
const SERVICE_UUIDS: BluetoothServiceUUID[] = [
  0x18f0,
  0xff00,
  0xffe0,
  0xfee7,
  0xfff0,
  0xff12,
  0xae30,
  0x1101,
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
];

// Cache the device for the lifetime of the page so repeat prints in a session
// don't have to round-trip through getDevices() each time.
let cachedDevice: BluetoothDevice | null = null;
let cachedServer: BluetoothRemoteGATTServer | null = null;
let cachedCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

function clearConnectionCache() {
  try {
    cachedServer?.disconnect();
  } catch {
    // ignore
  }
  cachedServer = null;
  cachedCharacteristic = null;
}

// ─── Auto-reconnect / connection-state subscription ──────────────────────────

export type BluetoothConnectionState =
  | "idle"
  | "unpaired"
  | "connecting"
  | "connected"
  | "error";

type ConnectionListener = (state: BluetoothConnectionState, error: string | null) => void;

let currentState: BluetoothConnectionState = "idle";
let currentError: string | null = null;
const stateListeners = new Set<ConnectionListener>();
const disconnectHandlers = new WeakMap<BluetoothDevice, EventListener>();
let reconnectAbort: AbortController | null = null;

function setState(state: BluetoothConnectionState, error: string | null = null) {
  currentState = state;
  currentError = error;
  stateListeners.forEach((l) => l(state, error));
}

export function getConnectionState(): {
  state: BluetoothConnectionState;
  error: string | null;
} {
  return { state: currentState, error: currentError };
}

export function subscribeConnectionState(cb: ConnectionListener): () => void {
  stateListeners.add(cb);
  cb(currentState, currentError);
  return () => {
    stateListeners.delete(cb);
  };
}

function textEncoder() {
  return new TextEncoder();
}

function escPosInit(): number[] {
  return [0x1b, 0x40];
}

function escPosAlign(align: "left" | "center" | "right"): number[] {
  const n = align === "left" ? 0 : align === "center" ? 1 : 2;
  return [0x1b, 0x61, n];
}

function escPosBold(on: boolean): number[] {
  return [0x1b, 0x45, on ? 1 : 0];
}

function escPosDoubleSize(on: boolean): number[] {
  return [0x1d, 0x21, on ? 0x11 : 0x00];
}

function escPosFeed(lines: number): number[] {
  return [0x1b, 0x64, Math.max(0, Math.min(255, lines))];
}

function escPosCut(): number[] {
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

export async function pairPrinter(): Promise<PairedPrinter> {
  if (!isBluetoothSupported()) throw new Error("Bluetooth not supported");

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICE_UUIDS,
  });

  cachedDevice = device;
  cachedServer = null;
  cachedCharacteristic = null;

  return {
    id: device.id,
    name: device.name || "Bluetooth Printer",
  };
}

async function findKnownDevice(target: PrinterTarget): Promise<BluetoothDevice | null> {
  if (cachedDevice) {
    if (target.printer_id && cachedDevice.id === target.printer_id) return cachedDevice;
    if (!target.printer_id && target.printer_name && cachedDevice.name === target.printer_name) {
      return cachedDevice;
    }
  }

  // getDevices() requires the Chromium flag
  // chrome://flags/#enable-web-bluetooth-new-permissions-backend
  // and only returns devices the origin still has permission for.
  const getDevices = navigator.bluetooth.getDevices?.bind(navigator.bluetooth);
  if (!getDevices) return null;

  let devices: BluetoothDevice[] = [];
  try {
    devices = await getDevices();
  } catch {
    return null;
  }

  if (!devices.length) return null;

  if (target.printer_id) {
    const byId = devices.find((d) => d.id === target.printer_id);
    if (byId) return byId;
  }
  if (target.printer_name) {
    const byName = devices.find((d) => d.name === target.printer_name);
    if (byName) return byName;
  }

  // Last-resort fallback for legacy installs where only one device permission
  // exists and names are unstable/blank after reconnect.
  if (devices.length === 1) return devices[0];

  return null;
}

async function findWritableCharacteristic(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
  for (const uuid of SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      const writable = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
      if (writable) return writable;
    } catch {
      // Service not present on this device; keep scanning.
    }
  }

  const services = await server.getPrimaryServices();
  for (const svc of services) {
    const chars = await svc.getCharacteristics();
    const writable = chars.find((c) => c.properties.writeWithoutResponse || c.properties.write);
    if (writable) return writable;
  }

  throw new Error(
    "No writable characteristic found. The printer's service UUID may not be in the supported list — try re-pairing.",
  );
}

function chunkBytes(bytes: Uint8Array, chunkSize = 20): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out.push(bytes.slice(i, i + chunkSize));
  }
  return out;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const dateLine = [
    ticket.ticket_date,
    ticket.issued_at
      ? new Date(ticket.issued_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null,
  ]
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

// Some BLE thermal printers won't accept a fresh GATT connect until they're
// actively advertising — `watchAdvertisements()` forces Chrome to scan for
// the device's beacons. The API is experimental but available in Chrome
// behind the standard Web Bluetooth flags. We use it best-effort.
type DeviceWithAdvertisements = BluetoothDevice & {
  watchAdvertisements?: (options?: { signal?: AbortSignal }) => Promise<void>;
  unwatchAdvertisements?: () => void;
  watchingAdvertisements?: boolean;
};

async function waitForAdvertisement(
  device: BluetoothDevice,
  timeoutMs: number,
): Promise<boolean> {
  const dev = device as DeviceWithAdvertisements;
  if (typeof dev.watchAdvertisements !== "function") return false;

  return new Promise<boolean>((resolve) => {
    const ctrl = new AbortController();
    let settled = false;

    const stopWatching = () => {
      try {
        ctrl.abort();
      } catch {
        // ignore
      }
      try {
        dev.unwatchAdvertisements?.();
      } catch {
        // ignore
      }
      device.removeEventListener("advertisementreceived", onAdv as EventListener);
    };

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      stopWatching();
      resolve(value);
    };

    const onAdv = () => finish(true);
    device.addEventListener("advertisementreceived", onAdv as EventListener);

    try {
      const promise = dev.watchAdvertisements!({ signal: ctrl.signal });
      promise.catch(() => finish(false));
    } catch {
      finish(false);
      return;
    }

    setTimeout(() => finish(false), timeoutMs);
  });
}

function attachDisconnectListener(device: BluetoothDevice, target: PrinterTarget) {
  const previous = disconnectHandlers.get(device);
  if (previous) {
    device.removeEventListener("gattserverdisconnected", previous);
  }
  const handler: EventListener = () => {
    clearConnectionCache();
    setState("connecting", "Printer disconnected, reconnecting…");
    void backgroundReconnect(target).catch(() => {
      /* state is updated inside backgroundReconnect */
    });
  };
  disconnectHandlers.set(device, handler);
  device.addEventListener("gattserverdisconnected", handler);
}

async function ensureConnection(
  device: BluetoothDevice,
): Promise<{ server: BluetoothRemoteGATTServer; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (
    cachedDevice === device &&
    cachedServer?.connected &&
    cachedCharacteristic &&
    cachedCharacteristic.service?.device === device
  ) {
    return { server: cachedServer, characteristic: cachedCharacteristic };
  }

  if (!device.gatt) throw new Error("Device has no GATT server");

  if (device.gatt.connected) {
    try {
      device.gatt.disconnect();
    } catch {
      // ignore
    }
  }

  const server = await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);

  cachedDevice = device;
  cachedServer = server;
  cachedCharacteristic = characteristic;

  return { server, characteristic };
}

function bleLog(...args: unknown[]) {
  if (typeof console !== "undefined") {
    console.info("[bluetooth]", ...args);
  }
}

// Run a long, progressive-backoff reconnect loop. BLE printers and Chrome's
// permission-cached devices often need several seconds + multiple attempts
// after a page reload before GATT connect succeeds. We try to wake the
// printer up via watchAdvertisements() between attempts so Chrome scans
// for it instead of blindly calling gatt.connect() on a stale handle.
async function backgroundReconnect(target: PrinterTarget): Promise<PrintResult> {
  if (!isBluetoothSupported()) {
    setState("error", "Web Bluetooth is not available in this browser.");
    return { ok: false, error: "Web Bluetooth is not available in this browser." };
  }
  if (!target.printer_id && !target.printer_name) {
    setState("unpaired");
    return { ok: false, error: "No printer paired." };
  }

  reconnectAbort?.abort();
  const ctrl = new AbortController();
  reconnectAbort = ctrl;

  setState("connecting", null);
  bleLog("reconnect started for", target);

  const start = Date.now();
  const maxDurationMs = 45_000;
  let attempt = 0;
  let lastError = "Could not reconnect to the saved Bluetooth printer.";

  while (!ctrl.signal.aborted && Date.now() - start < maxDurationMs) {
    attempt += 1;
    try {
      const device = await findKnownDevice(target);
      if (!device) {
        lastError =
          "Saved printer not visible to the browser. Enable chrome://flags/#enable-web-bluetooth-new-permissions-backend, restart Chrome, then re-pair the printer.";
        bleLog(`attempt ${attempt}: getDevices returned no match`);
      } else {
        cachedDevice = device;
        bleLog(`attempt ${attempt}: device matched`, { id: device.id, name: device.name });

        // Try to wake the printer via advertisement scan. If supported
        // and we get an advert, connect almost always succeeds on the
        // very next call.
        const sawAdv = await waitForAdvertisement(device, 4000);
        bleLog(`attempt ${attempt}: advertisement received? ${sawAdv}`);

        try {
          await ensureConnection(device);
          attachDisconnectListener(device, target);
          if (!ctrl.signal.aborted) setState("connected", null);
          bleLog(`attempt ${attempt}: connected`);
          return { ok: true };
        } catch (e) {
          lastError = e instanceof Error ? e.message : "Reconnect failed";
          clearConnectionCache();
          bleLog(`attempt ${attempt}: connect failed:`, lastError);
        }
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Reconnect failed";
      bleLog(`attempt ${attempt}: outer error:`, lastError);
    }

    const wait = Math.min(700 + attempt * 400, 3000);
    await delay(wait);
  }

  if (ctrl.signal.aborted) {
    bleLog("reconnect aborted after", attempt, "attempts");
    return { ok: false, error: "Reconnect aborted" };
  }

  bleLog("reconnect gave up after", attempt, "attempts:", lastError);
  setState("error", lastError);
  return { ok: false, error: lastError };
}

// Public auto-reconnect controller used by the entrance kiosk. Returns a
// teardown function. Reconnect attempts also run when the page becomes
// visible again or the window regains focus.
export function startAutoReconnect(target: PrinterTarget): () => void {
  if (!isBluetoothSupported()) {
    setState("error", "Web Bluetooth is not available in this browser.");
    return () => {};
  }
  if (!target.printer_id && !target.printer_name) {
    setState("unpaired");
    return () => {};
  }

  void backgroundReconnect(target);

  const onVisibility = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState !== "visible") return;
    if (currentState === "connected" || currentState === "connecting") return;
    void backgroundReconnect(target);
  };

  const onFocus = () => {
    if (currentState === "connected" || currentState === "connecting") return;
    void backgroundReconnect(target);
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("focus", onFocus);
  }

  return () => {
    reconnectAbort?.abort();
    reconnectAbort = null;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onFocus);
    }
  };
}

async function discoverAndConnectWithRetry(
  target: PrinterTarget,
  retries = 6,
): Promise<{ ok: true; characteristic: BluetoothRemoteGATTCharacteristic } | { ok: false; error: string }> {
  let lastError = "Saved printer not visible to the browser.";

  for (let i = 0; i < retries; i += 1) {
    if (i > 0) {
      clearConnectionCache();
      await delay(400 + i * 250);
    }

    const device = await findKnownDevice(target);
    if (!device) {
      lastError =
        "Saved printer not visible to the browser. Enable chrome://flags/#enable-web-bluetooth-new-permissions-backend, restart Chrome, then re-pair the printer.";
      continue;
    }

    cachedDevice = device;

    // Wake the printer via advertisement scan before attempting GATT
    // connect — drastically improves first-after-reload success.
    if (i === 0 || lastError.toLowerCase().includes("connect")) {
      const sawAdv = await waitForAdvertisement(device, 3500);
      bleLog(`print-path attempt ${i + 1}: advertisement received? ${sawAdv}`);
    }

    try {
      const { characteristic } = await ensureConnection(device);
      return { ok: true, characteristic };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Unknown Bluetooth reconnect error";
      bleLog(`print-path attempt ${i + 1}: connect failed:`, lastError);
    }
  }

  return { ok: false, error: lastError };
}

export async function printTicket(
  target: PrinterTarget,
  ticket: TicketLike,
  settings: PrinterSettings,
): Promise<PrintResult> {
  if (!isBluetoothSupported()) {
    return { ok: false, error: "Web Bluetooth is not available in this browser." };
  }

  if (!target.printer_id && !target.printer_name) {
    return { ok: false, error: "No printer paired. Pair a printer in Admin → Printer Settings." };
  }

  try {
    let characteristic: BluetoothRemoteGATTCharacteristic;
    if (
      cachedDevice &&
      cachedServer?.connected &&
      cachedCharacteristic &&
      cachedCharacteristic.service?.device === cachedDevice
    ) {
      characteristic = cachedCharacteristic;
    } else {
      const connected = await discoverAndConnectWithRetry(target, 5);
      if (!connected.ok) {
        setState("error", connected.error);
        return connected;
      }
      characteristic = connected.characteristic;
      if (cachedDevice) attachDisconnectListener(cachedDevice, target);
      setState("connected", null);
    }

    const bytes = buildTicketBytes(ticket, settings);
    const chunks = chunkBytes(bytes);

    for (const part of chunks) {
      const buf = part as BufferSource;
      try {
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(buf);
        } else {
          await characteristic.writeValue(buf);
        }
      } catch (writeErr) {
        // Some printers reject WoR mid-stream; retry with the safe write.
        await characteristic.writeValue(buf).catch(() => {
          throw writeErr;
        });
      }
      // Tiny gap between chunks — slow MCUs (HM-10 / CC2541) lose bytes
      // when the host writes at full BLE pace.
      await delay(8);
    }

    return { ok: true };
  } catch (e) {
    // Drop the cached connection so the next attempt re-handshakes cleanly.
    clearConnectionCache();
    const error = e instanceof Error ? e.message : "Unknown Bluetooth print error";
    setState("error", error);
    return { ok: false, error };
  }
}

// Kept for backward compat — used by the print fallback page.
export async function warmupBluetoothConnection(target: PrinterTarget): Promise<PrintResult> {
  return backgroundReconnect(target);
}

export async function testPrint(
  target: PrinterTarget,
  settings: PrinterSettings,
): Promise<PrintResult> {
  const now = new Date();
  return printTicket(
    target,
    {
      queue_display: "TEST",
      issued_at: now.toISOString(),
      ticket_date: now.toLocaleDateString(),
    },
    settings,
  );
}

export type PrinterDiagnostics = {
  bluetoothSupported: boolean;
  getDevicesAvailable: boolean;
  visibleCount: number;
  found: boolean;
  hint?: string;
};

export async function runtimeDiagnostics(target: PrinterTarget): Promise<PrinterDiagnostics> {
  const bluetoothSupported = isBluetoothSupported();
  if (!bluetoothSupported) {
    return {
      bluetoothSupported: false,
      getDevicesAvailable: false,
      visibleCount: 0,
      found: false,
      hint: "Use Chrome or Edge on Android, Windows, Mac, or Linux. iOS browsers do not support Web Bluetooth.",
    };
  }

  const getDevices = navigator.bluetooth.getDevices?.bind(navigator.bluetooth);
  if (!getDevices) {
    return {
      bluetoothSupported: true,
      getDevicesAvailable: false,
      visibleCount: 0,
      found: false,
      hint: "This browser version doesn't expose navigator.bluetooth.getDevices. Update Chrome/Edge to a recent version.",
    };
  }

  let devices: BluetoothDevice[] = [];
  try {
    devices = await getDevices();
  } catch {
    devices = [];
  }

  const found =
    !!(target.printer_id && devices.some((d) => d.id === target.printer_id)) ||
    !!(target.printer_name && devices.some((d) => d.name === target.printer_name));

  const hint = devices.length === 0
    ? "Browser can't see any previously-paired devices. Enable chrome://flags/#enable-web-bluetooth-new-permissions-backend, restart the browser, then re-pair."
    : !found && (target.printer_id || target.printer_name)
      ? "The saved printer isn't in the browser's permission list. Re-pair it from this page."
      : undefined;

  return {
    bluetoothSupported: true,
    getDevicesAvailable: true,
    visibleCount: devices.length,
    found,
    hint,
  };
}
