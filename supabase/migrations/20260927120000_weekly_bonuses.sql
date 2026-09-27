-- Weekly bonuses: the parent judges each finished week of a child's open
-- Contract and decides Grant or No bonus. A decision is stored, never the
-- amount: a granted week is worth the Contract's current Weekly bonus size,
-- the same way the current rate counts for all of its Stars. The Payout
-- records what the bonuses came to.

create table public.weekly_bonuses (
  contract_id uuid not null references public.contracts on delete cascade,
  -- The week's Monday.
  week_of date not null check (extract(isodow from week_of) = 1),
  granted boolean not null,
  decided_at timestamptz not null default now(),
  primary key (contract_id, week_of)
);

alter table public.weekly_bonuses enable row level security;

create policy "see visible children's Weekly bonuses" on public.weekly_bonuses for select to authenticated
  using (contract_id in (select id from public.contracts));

-- Grant or No bonus for one week of an open Contract, or a change of an earlier
-- decision. The week must touch the Contract and can be judged from its Friday.
-- Waiting Check-offs don't block it.
create function public.decide_weekly_bonus(p_contract_id uuid, p_week_of date, p_granted boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.contracts;
begin
  select * into c from public.contracts where id = p_contract_id;
  if c.id is null or not private.is_my_child(c.child_id) then
    raise exception 'not your Contract' using errcode = '42501';
  end if;
  if c.closed_on is not null then
    raise exception 'This Contract is closed.';
  end if;
  if p_granted is null then
    raise exception 'Choose Grant or No bonus.';
  end if;
  if p_week_of is null or extract(isodow from p_week_of) <> 1 then
    raise exception 'A week starts on a Monday.';
  end if;
  if p_week_of > c.ends_on or p_week_of + 4 < c.starts_on then
    raise exception 'This week is not in the Contract.';
  end if;
  if p_week_of + 4 > private.today() then
    raise exception 'A week can be judged from its Friday.';
  end if;
  if p_granted and c.weekly_bonus_stars = 0 then
    raise exception 'This Contract has no Weekly bonus.';
  end if;

  insert into public.weekly_bonuses (contract_id, week_of, granted)
  values (c.id, p_week_of, p_granted)
  on conflict (contract_id, week_of) do update set granted = excluded.granted, decided_at = now();
end $$;

revoke execute on function public.decide_weekly_bonus(uuid, date, boolean) from public, anon;
grant execute on function public.decide_weekly_bonus(uuid, date, boolean) to authenticated;

-- Star balances now count granted Weekly bonuses: stars is the whole balance,
-- task_stars and bonus_stars its two parts.
create or replace view public.star_balances with (security_invoker = true) as
  select
    c.child_id,
    c.id as contract_id,
    c.grosze_per_star,
    (from_tasks.stars + from_bonuses.stars)::int as stars,
    from_tasks.stars::int as task_stars,
    from_bonuses.stars::int as bonus_stars
  from public.contracts c
  cross join lateral (
    select count(*) as stars
    from public.tasks t
    join public.approvals a on a.task_id = t.id and a.approved and a.day between c.starts_on and c.ends_on
    where t.child_id = c.child_id
  ) from_tasks
  cross join lateral (
    select count(*) * c.weekly_bonus_stars as stars
    from public.weekly_bonuses w
    where w.contract_id = c.id and w.granted
  ) from_bonuses
  where c.closed_on is null;

-- Close & pay out, now with the granted Weekly bonuses at the Contract's size.
create or replace function public.close_contract(p_contract_id uuid) returns public.payouts
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
  select count(*) * c.weekly_bonus_stars into p.bonus_stars
  from public.weekly_bonuses w
  where w.contract_id = c.id and w.granted;
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
