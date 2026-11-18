-- Global Piper voice for all queue TV announcements (admin-configurable).

create table if not exists public.queue_voice_settings (
  id text primary key default 'default',
  piper_voice text not null default 'hfc_female_medium',
  updated_at timestamptz not null default now(),
  constraint queue_voice_settings_piper_voice_check check (
    piper_voice in (
    'hfc_female_medium', 'hfc_male_medium',
    'amy_medium', 'kristin_medium', 'lessac_medium', 'ryan_medium', 'john_medium',
    'bryce_medium', 'norman_medium', 'cori_medium', 'jenny_dioco_medium', 'alan_medium'
    )
  )
);

insert into public.queue_voice_settings (id, piper_voice)
values ('default', 'hfc_female_medium')
on conflict (id) do nothing;

-- Migration for databases created before the 12-voice catalog (safe to re-run).
-- Keep this list in sync with PIPER_VOICE_CHOICES in src/queue/piperVoices.ts.
alter table public.queue_voice_settings
  drop constraint if exists queue_voice_settings_piper_voice_check;
alter table public.queue_voice_settings
  add constraint queue_voice_settings_piper_voice_check check (
    piper_voice in (
    'hfc_female_medium', 'hfc_male_medium',
    'amy_medium', 'kristin_medium', 'lessac_medium', 'ryan_medium', 'john_medium',
    'bryce_medium', 'norman_medium', 'cori_medium', 'jenny_dioco_medium', 'alan_medium'
    )
  );
