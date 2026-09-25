-- Contracts and Payouts from the app: the parent creates, edits and closes a
-- child's Contract, and sets the child's Task list while building it. Every
-- write goes through the functions below, which check the rules; the tables
-- themselves stay read-only through the API.

-- A Payout is the single act that closes a Contract. It records what was paid,
-- so a past Contract shows its Payout without recomputing anything.
create table public.payouts (
  contract_id uuid primary key references public.contracts on delete cascade,
  paid_on date not null,
  task_stars integer not null check (task_stars >= 0),
  bonus_stars integer not null default 0 check (bonus_stars >= 0),
  amount_grosze integer not null check (amount_grosze >= 0),
  -- Check-offs still waiting for Approval at closing; they counted as 0.
  not_counted integer not null default 0 check (not_counted >= 0),
  -- The end date before closing, when the Contract was closed early.
  planned_ends_on date not null
);

alter table public.payouts enable row level security;

create policy "see visible children's Payouts" on public.payouts for select to authenticated
  using (contract_id in (select id from public.contracts));

create function private.is_my_child(p_child_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.children
    where id = p_child_id and family_id = private.my_family_id()
  )
$$;

create function private.has_school_day(p_from date, p_to date) returns boolean
language sql immutable as $$
  select exists (
    select 1 from generate_series(p_from, p_to, interval '1 day') d
    where private.is_school_day(d::date)
  )
$$;

-- Task list -------------------------------------------------------------------

-- Replaces a child's Task list from a given day on. p_tasks is the whole new
-- list in order, as [{"id": "<existing Task>"} | {"name": "...", "icon": "..."}].
-- A kept Task keeps its history; a dropped one stops counting from p_from; a
-- new one counts from p_from. Days before p_from keep the Tasks they had.
create function private.save_task_list(p_child_id uuid, p_from date, p_tasks jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  item jsonb;
  pos integer := 0;
  kept uuid[] := '{}';
begin
  if jsonb_typeof(p_tasks) is distinct from 'array' or jsonb_array_length(p_tasks) = 0 then
    raise exception 'Add at least one Task.';
  end if;

  for item in select * from jsonb_array_elements(p_tasks) loop
    if item ? 'id' then
      if not exists (
        select 1 from public.tasks
        where id = (item->>'id')::uuid and child_id = p_child_id and active_until is null
      ) then
        raise exception 'That Task is not on this child''s list.';
      end if;
      kept := kept || (item->>'id')::uuid;
    elsif length(trim(coalesce(item->>'name', ''))) = 0 then
      raise exception 'Every Task needs a name.';
    end if;
  end loop;

  -- Dropped Tasks: gone entirely if they hadn't started yet, else they stop at p_from.
  delete from public.tasks
  where child_id = p_child_id and active_until is null and not (id = any (kept))
    and active_from >= p_from;
  update public.tasks set active_until = p_from
  where child_id = p_child_id and active_until is null and not (id = any (kept));

  for item in select * from jsonb_array_elements(p_tasks) loop
    pos := pos + 1;
    if item ? 'id' then
      update public.tasks
      set position = pos, active_from = least(active_from, p_from)
      where id = (item->>'id')::uuid;
    else
      insert into public.tasks (child_id, name, icon, position, active_from)
      values (p_child_id, trim(item->>'name'), coalesce(nullif(trim(item->>'icon'), ''), '⭐'), pos, p_from);
    end if;
  end loop;
end $$;

-- Contracts -------------------------------------------------------------------

-- Creates a Contract for one of the parent's children, together with the
-- child's Task list. The start may be in the past; the end is today or later.
-- A child has one open Contract at a time, and Contracts never overlap.
create function public.create_contract(
  p_child_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_grosze_per_star integer,
  p_weekly_bonus_stars integer,
  p_tasks jsonb
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if not private.is_my_child(p_child_id) then
    raise exception 'not your child' using errcode = '42501';
  end if;
  if exists (select 1 from public.contracts where child_id = p_child_id and closed_on is null) then
    raise exception 'This child already has an open Contract.';
  end if;
  if p_ends_on < p_starts_on then
    raise exception 'The end must be on or after the start.';
  end if;
  if p_ends_on < private.today() then
    raise exception 'The end can''t be before today.';
  end if;
  if not private.has_school_day(p_starts_on, p_ends_on) then
    raise exception 'These dates contain no School days.';
  end if;
  if p_grosze_per_star is null or p_grosze_per_star <= 0 then
    raise exception 'Enter the rate in złoty, e.g. 0.50.';
  end if;
  if p_weekly_bonus_stars is null or p_weekly_bonus_stars < 0 then
    raise exception 'Enter the Weekly bonus as a whole number of gwiazdki (0 for none).';
  end if;

  begin
    insert into public.contracts (child_id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars)
    values (p_child_id, p_starts_on, p_ends_on, p_grosze_per_star, p_weekly_bonus_stars)
    returning id into new_id;
  exception when exclusion_violation then
    raise exception 'These dates overlap an earlier Contract.';
  end;

  perform private.save_task_list(p_child_id, p_starts_on, p_tasks);
  return new_id;
end $$;

-- Edits an open Contract: its dates and the child's Task list. The rate and the
-- Weekly bonus are fixed. The start can change only while it is in the future;
-- the end is today or later. Task list changes count from the next day, or
-- from the start while the Contract hasn't started.
create function public.update_contract(
  p_contract_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_tasks jsonb
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.contracts;
  today date := private.today();
begin
  select * into c from public.contracts where id = p_contract_id;
  if c.id is null or not private.is_my_child(c.child_id) then
    raise exception 'not your Contract' using errcode = '42501';
  end if;
  if c.closed_on is not null then
    raise exception 'This Contract is closed.';
  end if;
  if p_starts_on <> c.starts_on and c.starts_on <= today then
    raise exception 'The start can''t change: the Contract has already started.';
  end if;
  if p_ends_on < p_starts_on then
    raise exception 'The end must be on or after the start.';
  end if;
  if p_ends_on < today then
    raise exception 'The end can''t be before today.';
  end if;
  if not private.has_school_day(p_starts_on, p_ends_on) then
    raise exception 'These dates contain no School days.';
  end if;

  begin
    update public.contracts set starts_on = p_starts_on, ends_on = p_ends_on where id = c.id;
  exception when exclusion_violation then
    raise exception 'These dates overlap an earlier Contract.';
  end;

  perform private.save_task_list(
    c.child_id,
    case when c.starts_on > today then p_starts_on else today + 1 end,
    p_tasks);
end $$;

-- Close & pay out: closes an open Contract that has started and records its
-- Payout. Check-offs still waiting count as 0. Closing before the end date
-- moves the end date to today. Afterwards the Contract is frozen.
create function public.close_contract(p_contract_id uuid) returns public.payouts
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.contracts;
  today date := private.today();
  last_day date;
  p public.payouts;
begin
  select * into c from public.contracts where id = p_contract_id;
  if c.id is null or not private.is_my_child(c.child_id) then
    raise exception 'not your Contract' using errcode = '42501';
  end if;
  if c.closed_on is not null then
    raise exception 'This Contract is already closed.';
  end if;
  if c.starts_on > today then
    raise exception 'This Contract hasn''t started yet.';
  end if;
  last_day := least(c.ends_on, today);

  p.contract_id := c.id;
  p.paid_on := today;
  p.planned_ends_on := c.ends_on;
  p.bonus_stars := 0;
  select count(*) into p.task_stars
  from public.approvals a join public.tasks t on t.id = a.task_id
  where t.child_id = c.child_id and a.approved and a.day between c.starts_on and last_day;
  select count(*) into p.not_counted
  from public.check_offs k join public.tasks t on t.id = k.task_id
  where t.child_id = c.child_id and k.day between c.starts_on and last_day
    and not exists (select 1 from public.approvals a where a.task_id = k.task_id and a.day = k.day);
  p.amount_grosze := (p.task_stars + p.bonus_stars) * c.grosze_per_star;

  update public.contracts set ends_on = last_day, closed_on = today where id = c.id;
  insert into public.payouts select p.*;
  return p;
end $$;

revoke execute on function public.create_contract(uuid, date, date, integer, integer, jsonb) from public, anon;
revoke execute on function public.update_contract(uuid, date, date, jsonb) from public, anon;
revoke execute on function public.close_contract(uuid) from public, anon;
grant execute on function public.create_contract(uuid, date, date, integer, integer, jsonb) to authenticated;
grant execute on function public.update_contract(uuid, date, date, jsonb) to authenticated;
grant execute on function public.close_contract(uuid) to authenticated;
