-- The first usable version: families, children and their Tasks, Contracts,
-- Check-offs and Approvals. Stars are never stored; they are computed from
-- approved Approvals inside a child's open Contract.

create schema if not exists private;
create extension if not exists btree_gist with schema extensions;

-- Families ------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.parents (
  user_id uuid primary key references auth.users on delete cascade,
  family_id uuid not null references public.families on delete cascade
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  -- Set once the child has joined on their own device with a Join code.
  user_id uuid unique references auth.users on delete set null,
  name text not null check (length(trim(name)) > 0)
);

-- A Task is on one child's own list. It counts on School days from
-- active_from until (not including) active_until.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children on delete cascade,
  name text not null check (length(trim(name)) > 0),
  icon text not null,
  position integer not null default 0,
  active_from date not null,
  active_until date,
  check (active_until is null or active_until > active_from)
);

-- A child has at most one open Contract, and Contracts never overlap.
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children on delete cascade,
  starts_on date not null,
  ends_on date not null,
  grosze_per_star integer not null check (grosze_per_star > 0),
  weekly_bonus_stars integer not null default 3 check (weekly_bonus_stars >= 0),
  closed_on date,
  check (ends_on >= starts_on),
  exclude using gist (child_id with =, daterange(starts_on, ends_on, '[]') with &&)
);

create unique index contracts_one_open_per_child
  on public.contracts (child_id) where closed_on is null;

-- A Check-off is a child's claim that they did one Task on one School day.
create table public.check_offs (
  task_id uuid not null references public.tasks on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (task_id, day)
);

-- An Approval is the parent's decision on one Task on one School day.
create table public.approvals (
  task_id uuid not null references public.tasks on delete cascade,
  day date not null,
  approved boolean not null,
  decided_at timestamptz not null default now(),
  primary key (task_id, day)
);

create index tasks_child_id on public.tasks (child_id);
create index contracts_child_id on public.contracts (child_id);
create index children_family_id on public.children (family_id);
create index parents_family_id on public.parents (family_id);

alter table public.families enable row level security;
alter table public.parents enable row level security;
alter table public.children enable row level security;
alter table public.tasks enable row level security;
alter table public.contracts enable row level security;
alter table public.check_offs enable row level security;
alter table public.approvals enable row level security;

-- Who is asking ---------------------------------------------------------------
-- security definer so policies can look people up without recursing into RLS.

create function private.my_family_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.parents where user_id = auth.uid()
$$;

create function private.my_child_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.children where user_id = auth.uid()
$$;

-- The children the current user may see: all of a parent's family, or a child themselves.
create function private.visible_child_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.children where family_id = private.my_family_id()
  union all
  select private.my_child_id()
$$;

grant usage on schema private to authenticated;

create policy "family members see their family" on public.families for select to authenticated
  using (id = private.my_family_id()
      or id = (select family_id from public.children where id = private.my_child_id()));

create policy "parents see themselves" on public.parents for select to authenticated
  using (user_id = auth.uid());

create policy "see visible children" on public.children for select to authenticated
  using (id in (select private.visible_child_ids()));

create policy "see visible children's Tasks" on public.tasks for select to authenticated
  using (child_id in (select private.visible_child_ids()));

create policy "see visible children's Contracts" on public.contracts for select to authenticated
  using (child_id in (select private.visible_child_ids()));

create policy "see visible children's Check-offs" on public.check_offs for select to authenticated
  using (task_id in (select id from public.tasks));

create policy "see visible children's Approvals" on public.approvals for select to authenticated
  using (task_id in (select id from public.tasks));

-- Time ----------------------------------------------------------------------
-- "Today" and the Check-off deadline are in Warsaw time. Tests replace
-- private.clock() to freeze time.

create function private.clock() returns timestamptz
language sql stable as $$ select now() $$;

create function private.today() returns date
language sql stable as $$ select (private.clock() at time zone 'Europe/Warsaw')::date $$;

create function private.is_school_day(d date) returns boolean
language sql immutable as $$ select extract(isodow from d) between 1 and 5 $$;

-- A child can make or undo a Check-off until 22:00 the next calendar day.
create function private.check_off_deadline(d date) returns timestamptz
language sql stable as $$ select ((d + 1) + time '22:00') at time zone 'Europe/Warsaw' $$;

-- Check-offs ------------------------------------------------------------------

-- Whether the signed-in child may make or undo a Check-off of this Task on this day:
-- their own Task, on a School day it counts, inside their open Contract, not in the
-- future, before the deadline, and not yet decided by the parent.
create function private.child_may_check_off(p_task_id uuid, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tasks t
    join public.contracts c on c.child_id = t.child_id and c.closed_on is null
    where t.id = p_task_id
      and t.child_id = private.my_child_id()
      and private.is_school_day(p_day)
      and p_day <= private.today()
      and private.clock() < private.check_off_deadline(p_day)
      and p_day >= t.active_from and (t.active_until is null or p_day < t.active_until)
      and p_day between c.starts_on and c.ends_on
      and not exists (select 1 from public.approvals a where a.task_id = p_task_id and a.day = p_day)
  )
$$;

create policy "a child makes their own Check-offs" on public.check_offs for insert to authenticated
  with check (private.child_may_check_off(task_id, day));

create policy "a child undoes their own Check-offs" on public.check_offs for delete to authenticated
  using (private.child_may_check_off(task_id, day));

-- Approvals -------------------------------------------------------------------

-- Whether the signed-in parent may decide on this Task on this day: a Task of
-- their family, on a School day it counts, up to today, inside the child's open
-- Contract. A closed Contract's days are frozen.
create function private.parent_may_decide(p_task_id uuid, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tasks t
    join public.children ch on ch.id = t.child_id
    join public.contracts c on c.child_id = t.child_id and c.closed_on is null
    where t.id = p_task_id
      and ch.family_id = private.my_family_id()
      and private.is_school_day(p_day)
      and p_day <= private.today()
      and p_day >= t.active_from and (t.active_until is null or p_day < t.active_until)
      and p_day between c.starts_on and c.ends_on
  )
$$;

create policy "a parent makes Approvals" on public.approvals for insert to authenticated
  with check (private.parent_may_decide(task_id, day));

create policy "a parent changes Approvals" on public.approvals for update to authenticated
  using (private.parent_may_decide(task_id, day))
  with check (private.parent_may_decide(task_id, day));

create policy "a parent takes Approvals back" on public.approvals for delete to authenticated
  using (private.parent_may_decide(task_id, day));

-- Stars -----------------------------------------------------------------------

-- Each child's Star balance in their open Contract: one Star per approved Task.
-- Computed on every read and subject to the caller's RLS.
create view public.star_balances with (security_invoker = true) as
  select
    c.child_id,
    c.id as contract_id,
    c.grosze_per_star,
    count(a.task_id)::int as stars
  from public.contracts c
  left join public.tasks t on t.child_id = c.child_id
  left join public.approvals a
    on a.task_id = t.id and a.approved and a.day between c.starts_on and c.ends_on
  where c.closed_on is null
  group by c.id;
