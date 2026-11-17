-- Global Piper voice for all queue TV announcements (admin-configurable).

create table if not exists public.queue_voice_settings (
  id text primary key default 'default',
  piper_voice text not null default 'hfc_female_medium',
  updated_at timestamptz not null default now(),
  constraint queue_voice_settings_piper_voice_check check (
    piper_voice in ('hfc_female_medium', 'hfc_male_medium')
  )
);

insert into public.queue_voice_settings (id, piper_voice)
values ('default', 'hfc_female_medium')
on conflict (id) do nothing;