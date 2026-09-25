-- The parent can change a Contract's rate and Weekly bonus while it is open,
-- so a Contract stays flexible. The rate applies to the whole Contract: the
-- balance and the Payout always use the current rate.

drop function public.update_contract(uuid, date, date, jsonb);

-- Edits an open Contract: its dates, rate, Weekly bonus and the child's Task
-- list. The start can change only while it is in the future; the end is today
-- or later. Task list changes count from the next day, or from the start while
-- the Contract hasn't started.
create function public.update_contract(
  p_contract_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_grosze_per_star integer,
  p_weekly_bonus_stars integer,
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
  if p_grosze_per_star is null or p_grosze_per_star <= 0 then
    raise exception 'Enter the rate in złoty, e.g. 0.50.';
  end if;
  if p_weekly_bonus_stars is null or p_weekly_bonus_stars < 0 then
    raise exception 'Enter the Weekly bonus as a whole number of gwiazdki (0 for none).';
  end if;

  begin
    update public.contracts
    set starts_on = p_starts_on, ends_on = p_ends_on,
        grosze_per_star = p_grosze_per_star, weekly_bonus_stars = p_weekly_bonus_stars
    where id = c.id;
  exception when exclusion_violation then
    raise exception 'These dates overlap an earlier Contract.';
  end;

  perform private.save_task_list(
    c.child_id,
    case when c.starts_on > today then p_starts_on else today + 1 end,
    p_tasks);
end $$;

revoke execute on function public.update_contract(uuid, date, date, integer, integer, jsonb) from public, anon;
grant execute on function public.update_contract(uuid, date, date, integer, integer, jsonb) to authenticated;
