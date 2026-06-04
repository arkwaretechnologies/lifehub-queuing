-- Admin-configurable printer settings for the Entrance kiosk.
-- This doesn't force printer selection (browsers can't), but stores:
-- - which template to use
-- - paper sizing and header/footer text

create table if not exists public.printer_settings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  paper_width_mm int not null default 58,
  header_text text null,
  footer_text text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bluetooth printer identification: the device name is shown to the operator,
-- the device id is the stable handle used by navigator.bluetooth.getDevices().
-- Some BLE thermal printers advertise an empty/changing name, so we match by
-- id first and fall back to name.
alter table public.printer_settings
  add column if not exists printer_name text null;

alter table public.printer_settings
  add column if not exists printer_id text null;

