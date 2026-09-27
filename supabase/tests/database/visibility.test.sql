begin;
select plan(8);
\ir _fixtures.psql

-- Ada and Ben each had a Contract in August, closed and paid out.
insert into public.contracts (id, child_id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars, closed_on) values
  ('c7000000-0000-0000-0000-0000000008a1', 'c0000000-0000-0000-0000-0000000000a1', '2026-08-03', '2026-08-31', 50, 0, '2026-08-31'),
  ('c7000000-0000-0000-0000-0000000008a2', 'c0000000-0000-0000-0000-0000000000a2', '2026-08-03', '2026-08-31', 40, 0, '2026-08-31');
insert into public.payouts (contract_id, paid_on, task_stars, amount_grosze, planned_ends_on) values
  ('c7000000-0000-0000-0000-0000000008a1', '2026-08-31', 30, 1500, '2026-08-31'),
  ('c7000000-0000-0000-0000-0000000008a2', '2026-08-31', 20, 800, '2026-08-31');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select results_eq(
  'select name from tasks order by name',
  $$ values ('Brush teeth'::text), ('Pack school bag') $$,
  'a child sees only their own Tasks'
);
select results_eq(
  'select name from children',
  $$ values ('Ada'::text) $$,
  'a child sees only themselves, not their siblings'
);
select results_eq(
  'select grosze_per_star from contracts where closed_on is null',
  $$ values (50) $$,
  'a child sees their own Contract, so the app can show the PLN value'
);
select results_eq(
  'select amount_grosze from payouts',
  $$ values (1500) $$,
  'a child sees their own Payouts and not a sibling''s'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
select results_eq(
  'select name from children order by name',
  $$ values ('Ada'::text), ('Ben') $$,
  'a parent sees all of their own children and no one else''s'
);
select results_eq(
  'select name from tasks order by name',
  $$ values ('Brush teeth'::text), ('Pack school bag'), ('Read 20 minutes') $$,
  'a parent sees their children''s Tasks and no one else''s'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000ff');
select is_empty('select * from tasks', 'a signed-in stranger sees no Tasks');

select pg_temp.act_as_admin();
select set_config('role', 'anon', true);
select is_empty('select * from children', 'someone not signed in sees no one');

select * from finish();
rollback;
