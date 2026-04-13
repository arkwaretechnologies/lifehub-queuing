-- Screen + media configuration tables for lifehub-queuing (Level B admin config).
-- Run this in Supabase SQL editor (same database as existing queue_* and users tables).

create table if not exists public.queue_screens (
  screen_id text primary key,
  name text null,
  counter_codes text[] not null default '{}',
  playlist_id uuid null,
  is_active boolean not null default true,
  -- Entrance split (you chose: same counter, split by priority)
  entrance_counter_code text null,
  entrance_regular_priority_code text null,
  entrance_priority_priority_code text null,
  updated_at timestamptz not null default now()
);

create table if not exists public.media_playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  loop boolean not null default true,
  is_default boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.media_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.media_playlists(id) on delete cascade,
  sort_order int not null default 0,
  type text not null check (type in ('video', 'youtube', 'image')),
  src text not null,
  title text null,
  duration_seconds int null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_media_playlist_items_playlist on public.media_playlist_items(playlist_id);
create index if not exists idx_media_playlist_items_sort on public.media_playlist_items(playlist_id, sort_order);

-- Suggested storage bucket:
-- Create a bucket named 'media' in Supabase Storage for uploaded MP4 files.

