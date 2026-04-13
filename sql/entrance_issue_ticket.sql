-- Atomic ticket issuance for Entrance kiosk.
-- Creates (or reuses) today's queue_session for the counter, computes the next
-- sequence number per priority lane for the day, inserts a queue_ticket, and
-- returns the inserted row.
--
-- Usage (Supabase RPC): select * from public.issue_queue_ticket('ENTRANCE', 'REG', 'Walk-in');
-- Assumes:
-- - queue_counters.code = p_counter_code exists
-- - queue_priorities.code = p_priority_code exists
-- - queue_sessions.last_number exists and is used for sequencing

create or replace function public.issue_queue_ticket(
  p_counter_code text,
  p_priority_code text,
  p_registration_type text default 'Walk-in'
)
returns table (
  id uuid,
  counter_id uuid,
  priority_id integer,
  queue_number integer,
  queue_display text,
  ticket_date date,
  status text,
  issued_at timestamptz
)
language plpgsql
security definer
as $$
declare
  v_counter_id uuid;
  v_priority_id integer;
  v_session_id uuid;
  v_next_number integer;
  v_display_number integer;
  v_priority_prefix text;
begin
  select qc.id into v_counter_id
  from public.queue_counters qc
  where qc.code = p_counter_code and qc.is_active = true;
  if v_counter_id is null then
    raise exception 'Unknown counter_code: %', p_counter_code;
  end if;

  select
    qp.id,
    case
      when upper(qp.code) like 'REG%' or upper(coalesce(qp.name, '')) like '%REGULAR%' then 'R'
      when upper(qp.code) like 'PRI%' or upper(coalesce(qp.name, '')) like '%PRIORITY%' then 'P'
      else left(upper(qp.code), 1)
    end
  into v_priority_id, v_priority_prefix
  from public.queue_priorities qp
  where qp.code = p_priority_code and qp.is_active = true;
  if v_priority_id is null then
    raise exception 'Unknown priority_code: %', p_priority_code;
  end if;

  -- Lock or create today's session.
  -- We avoid `ON CONFLICT (counter_id, session_date)` because `counter_id` is also
  -- a RETURNS TABLE output column (a PL/pgSQL variable), which can lead to
  -- "column reference ... is ambiguous" in some setups.
  loop
    select qs.id
    into v_session_id
    from public.queue_sessions qs
    where qs.counter_id = v_counter_id
      and qs.session_date = current_date
    for update;

    if v_session_id is not null then
      update public.queue_sessions
      set updated_at = now()
      where queue_sessions.id = v_session_id;
      exit;
    end if;

    begin
      insert into public.queue_sessions(counter_id, session_date, opened_at, status)
      values (v_counter_id, current_date, now(), 'Open')
      returning id into v_session_id;
      exit;
    exception
      when unique_violation then
        -- Another concurrent call created the session; retry and lock it.
        v_session_id := null;
    end;
  end loop;

  -- Compute the next unique session number for database storage.
  select coalesce(max(qt.queue_number), 0) + 1
  into v_next_number
  from public.queue_tickets qt
  where qt.queue_session_id = v_session_id
    and qt.ticket_date = current_date;

  -- Compute the next displayed number per priority lane for today.
  select count(*) + 1
  into v_display_number
  from public.queue_tickets qt
  where qt.counter_id = v_counter_id
    and qt.priority_id = v_priority_id
    and qt.ticket_date = current_date;

  update public.queue_sessions
  set last_number = greatest(coalesce(last_number, 0), v_next_number),
      updated_at = now()
  where queue_sessions.id = v_session_id
  ;

  insert into public.queue_tickets(
    queue_session_id,
    counter_id,
    priority_id,
    queue_number,
    queue_display,
    ticket_date,
    registration_type,
    status,
    issued_at,
    created_at,
    updated_at
  )
  values (
    v_session_id,
    v_counter_id,
    v_priority_id,
    v_next_number,
    v_priority_prefix || ' - ' || lpad(v_display_number::text, 3, '0'),
    current_date,
    p_registration_type,
    'Waiting',
    now(),
    now(),
    now()
  )
  returning
    queue_tickets.id,
    queue_tickets.counter_id,
    queue_tickets.priority_id,
    queue_tickets.queue_number,
    queue_tickets.queue_display,
    queue_tickets.ticket_date,
    queue_tickets.status,
    queue_tickets.issued_at
  into id, counter_id, priority_id, queue_number, queue_display, ticket_date, status, issued_at;

  return next;
end;
$$;

