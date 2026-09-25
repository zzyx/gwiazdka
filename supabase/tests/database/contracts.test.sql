-- The parent runs Contracts from the app: create one with the child's Task list
-- (the start may be in the past), edit its dates and Tasks, and Close & pay out.
-- Only through the functions; the tables stay read-only.
begin;
select plan(25);
\ir _fixtures.psql

-- Today is Wednesday 23 September 2026. Ada has an open Contract from 1 September,
-- Ben has none. Pat is their parent; Quinn is another family's parent.
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');

-- Create -----------------------------------------------------------------------

select lives_ok(
  $$ select create_contract('c0000000-0000-0000-0000-0000000000a2', '2026-09-07', '2027-01-29', 40, 2,
       '[{"id": "70000000-0000-0000-0000-0000000000a2"}, {"name": "Make the bed", "icon": "🛏️"}]') $$,
  'a parent creates a Contract for a child, starting in the past'
);
select results_eq(
  $$ select starts_on, ends_on, grosze_per_star, weekly_bonus_stars, closed_on
     from contracts where child_id = 'c0000000-0000-0000-0000-0000000000a2' $$,
  $$ values ('2026-09-07'::date, '2027-01-29'::date, 40, 2, null::date) $$,
  'the Contract has the dates, rate and Weekly bonus the parent chose'
);
select results_eq(
  $$ select name, position, active_from, active_until from tasks
     where child_id = 'c0000000-0000-0000-0000-0000000000a2' order by position $$,
  $$ values ('Read 20 minutes'::text, 1, '2026-09-01'::date, null::date),
            ('Make the bed', 2, '2026-09-07', null) $$,
  'a kept Task keeps its history and a new one counts from the start'
);
select lives_ok(
  $$ insert into approvals (task_id, day, approved)
     select id, '2026-09-08', true from tasks where name = 'Make the bed' $$,
  'the parent can approve a past School day inside the new Contract'
);
select throws_ok(
  $$ select create_contract('c0000000-0000-0000-0000-0000000000a2', '2027-02-01', '2027-06-25', 40, 2,
       '[{"name": "Homework", "icon": "✏️"}]') $$,
  'This child already has an open Contract.',
  'a child has one open Contract at a time'
);
select throws_ok(
  $$ select create_contract('c0000000-0000-0000-0000-0000000000a1', '2026-01-05', '2026-06-26', 40, 2,
       '[{"name": "Homework", "icon": "✏️"}]') $$,
  'This child already has an open Contract.',
  'a Contract that already ended can''t be created while another is open'
);

-- Only through the functions, only for the parent's own family.
select throws_ok(
  $$ insert into contracts (child_id, starts_on, ends_on, grosze_per_star)
     values ('c0000000-0000-0000-0000-0000000000a2', '2027-02-01', '2027-06-25', 40) $$,
  '42501', null,
  'a parent cannot write Contracts directly'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000b0b0');
select throws_ok(
  $$ select create_contract('c0000000-0000-0000-0000-0000000000a2', '2027-02-01', '2027-06-25', 40, 2,
       '[{"name": "Homework", "icon": "✏️"}]') $$,
  '42501', null,
  'another family''s parent cannot create a Contract'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select close_contract('c7000000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'a child cannot close their own Contract'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');

-- Edit -------------------------------------------------------------------------

select throws_ok(
  $$ select update_contract('c7000000-0000-0000-0000-0000000000a1', '2026-09-14', '2027-01-31',
       '[{"id": "70000000-0000-0000-0000-0000000000a1"}, {"id": "70000000-0000-0000-0000-0000000000a3"}]') $$,
  'The start can''t change: the Contract has already started.',
  'the start of a Contract that has started is fixed'
);
select throws_ok(
  $$ select update_contract('c7000000-0000-0000-0000-0000000000a1', '2026-09-01', '2026-09-22',
       '[{"id": "70000000-0000-0000-0000-0000000000a1"}, {"id": "70000000-0000-0000-0000-0000000000a3"}]') $$,
  'The end can''t be before today.',
  'the end can''t move before today'
);
select throws_ok(
  $$ select update_contract('c7000000-0000-0000-0000-0000000000a1', '2026-09-01', '2027-01-31', '[]') $$,
  'Add at least one Task.',
  'a Contract needs at least one Task'
);
select lives_ok(
  $$ select update_contract('c7000000-0000-0000-0000-0000000000a1', '2026-09-01', '2026-12-18',
       '[{"name": "Feed the fish", "icon": "🐟"}, {"id": "70000000-0000-0000-0000-0000000000a1"}]') $$,
  'a parent edits the end date and the Task list of an open Contract'
);
select results_eq(
  $$ select name, position, active_from, active_until from tasks
     where child_id = 'c0000000-0000-0000-0000-0000000000a1' order by active_until nulls first, position $$,
  $$ values ('Feed the fish'::text, 1, '2026-09-24'::date, null::date),
            ('Brush teeth', 2, '2026-09-01', null),
            ('Pack school bag', 0, '2026-09-01', '2026-09-24') $$,
  'Task list changes count from the next day; today keeps its Tasks'
);
select is(
  (select ends_on from contracts where id = 'c7000000-0000-0000-0000-0000000000a1'),
  '2026-12-18'::date,
  'the new end date is saved'
);

-- A Contract that hasn't started yet: its start can move, and it can't be paid out.
select pg_temp.act_as('00000000-0000-0000-0000-00000000b0b0');
select lives_ok(
  $$ select close_contract('c7000000-0000-0000-0000-0000000000b1') $$,
  'a parent closes an open Contract that has started'
);
select lives_ok(
  $$ select create_contract('c0000000-0000-0000-0000-0000000000b1', '2026-10-05', '2027-01-29', 100, 3,
       '[{"id": "70000000-0000-0000-0000-0000000000b1"}]') $$,
  'a parent creates a Contract that starts in the future'
);
select lives_ok(
  $$ select update_contract((select id from contracts where child_id = 'c0000000-0000-0000-0000-0000000000b1' and closed_on is null),
       '2026-10-12', '2027-01-29', '[{"id": "70000000-0000-0000-0000-0000000000b1"}]') $$,
  'the start of a Contract that hasn''t started can move'
);
select throws_ok(
  $$ select close_contract((select id from contracts where child_id = 'c0000000-0000-0000-0000-0000000000b1' and closed_on is null)) $$,
  'This Contract hasn''t started yet.',
  'a Contract that hasn''t started can''t be paid out'
);

-- Close & pay out ----------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
-- Ada: two approved, one rejected, one Check-off still waiting today.
select pg_temp.act_as_admin();
insert into approvals (task_id, day, approved) values
  ('70000000-0000-0000-0000-0000000000a1', '2026-09-21', true),
  ('70000000-0000-0000-0000-0000000000a3', '2026-09-21', true),
  ('70000000-0000-0000-0000-0000000000a1', '2026-09-22', false);
insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-23');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');

select results_eq(
  $$ select paid_on, task_stars, bonus_stars, amount_grosze, not_counted, planned_ends_on
     from close_contract('c7000000-0000-0000-0000-0000000000a1') $$,
  $$ values ('2026-09-23'::date, 2, 0, 100, 1, '2026-12-18'::date) $$,
  'Close & pay out pays the approved Stars at the rate; waiting Check-offs count as 0'
);
select results_eq(
  $$ select ends_on, closed_on from contracts where id = 'c7000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('2026-09-23'::date, '2026-09-23'::date) $$,
  'closing early moves the end date to today'
);
update approvals set approved = true
  where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-09-22';
select is(
  (select count(*)::int from approvals
   where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-09-22' and approved),
  0,
  'a closed Contract is frozen: its decisions can''t change'
);
select throws_ok(
  $$ select create_contract('c0000000-0000-0000-0000-0000000000a1', '2026-09-21', '2027-01-29', 50, 3,
       '[{"id": "70000000-0000-0000-0000-0000000000a1"}]') $$,
  'These dates overlap an earlier Contract.',
  'a new Contract can''t overlap the previous one'
);
select lives_ok(
  $$ select create_contract('c0000000-0000-0000-0000-0000000000a1', '2026-09-24', '2027-01-29', 50, 3,
       '[{"id": "70000000-0000-0000-0000-0000000000a1"}]') $$,
  'the next Contract starts after the closed one'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select results_eq(
  $$ select task_stars, amount_grosze from payouts $$,
  $$ values (2, 100) $$,
  'a child sees their own Payouts'
);

select * from finish();
rollback;
