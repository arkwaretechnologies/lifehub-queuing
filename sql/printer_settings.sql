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

