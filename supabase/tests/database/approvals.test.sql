-- Approvals: the parent's decision on one Task on one School day.
-- The clock is frozen at Wednesday 23 September 2026, 10:00 in Warsaw.
begin;
select plan(13);
\ir _fixtures.psql

-- Ada checked off Brush teeth on Tuesday. She had a Contract before this one, now closed.
insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-22');
insert into contracts (child_id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars, closed_on) values
  ('c0000000-0000-0000-0000-0000000000a1', '2026-06-01', '2026-06-30', 50, 3, '2026-06-30');
insert into approvals (task_id, day, approved) values ('70000000-0000-0000-0000-0000000000a1', '2026-06-15', true);

select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');

select lives_ok(
  $$ insert into approvals (task_id, day, approved) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-22', true) $$,
  'a parent approves their child''s Check-off'
);
select lives_ok(
  $$ update approvals set approved = false where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-09-22' $$,
  'a parent changes their decision'
);
select results_eq(
  $$ select approved from approvals where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-09-22' $$,
  $$ values (false) $$,
  'the changed decision is stored'
);
select lives_ok(
  $$ delete from approvals where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-09-22' $$,
  'a parent takes a decision back, so the Check-off waits again'
);
select lives_ok(
  $$ insert into approvals (task_id, day, approved) values ('70000000-0000-0000-0000-0000000000a3', '2026-09-14', true) $$,
  'a parent approves a Task the child did not check off, on any earlier day of the open Contract'
);
select throws_ok(
  $$ insert into approvals (task_id, day, approved) values ('70000000-0000-0000-0000-0000000000b1', '2026-09-22', true) $$,
  '42501', null,
  'a parent cannot decide on another family''s Task'
);
select throws_ok(
  $$ insert into approvals (task_id, day, approved) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-19', true) $$,
  '42501', null,
  'a parent cannot decide on a weekend day'
);
select throws_ok(
  $$ insert into approvals (task_id, day, approved) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-24', true) $$,
  '42501', null,
  'a parent cannot decide on a day that has not come yet'
);
select throws_ok(
  $$ insert into approvals (task_id, day, approved) values ('70000000-0000-0000-0000-0000000000a1', '2026-06-16', true) $$,
  '42501', null,
  'a parent cannot decide on a day in a closed Contract'
);
update approvals set approved = false where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-06-15';
select results_eq(
  $$ select approved from approvals where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-06-15' $$,
  $$ values (true) $$,
  'a closed Contract''s decisions are frozen'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into approvals (task_id, day, approved) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-23', true) $$,
  '42501', null,
  'a child cannot approve their own Task'
);
update approvals set approved = true where task_id = '70000000-0000-0000-0000-0000000000a3' and day = '2026-09-14';
delete from approvals where task_id = '70000000-0000-0000-0000-0000000000a3';
select results_eq(
  $$ select approved from approvals where task_id = '70000000-0000-0000-0000-0000000000a3' $$,
  $$ values (true) $$,
  'a child cannot change or remove an Approval'
);
select results_eq(
  $$ select count(*)::int from approvals $$,
  $$ values (2) $$,
  'a child sees their own Approvals, so the app shows each Task''s state'
);

select * from finish();
rollback;
