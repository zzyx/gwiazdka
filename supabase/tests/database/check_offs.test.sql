-- Check-offs: a child's claim that they did one Task on one School day.
-- The clock is frozen at Wednesday 23 September 2026, 10:00 in Warsaw.
begin;
select plan(15);
\ir _fixtures.psql

-- Ada: Brush teeth ...a1, Pack school bag ...a3. Ben: Read 20 minutes ...a2 (no open Contract).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-23') $$,
  'a child checks off their own Task today'
);
select lives_ok(
  $$ delete from check_offs where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-09-23' $$,
  'a child undoes a Check-off today'
);
select is_empty(
  $$ select * from check_offs where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-09-23' $$,
  'the undone Check-off is gone'
);
select lives_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-22') $$,
  'a child can still check off yesterday before 22:00 today'
);
select throws_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-21') $$,
  '42501', null,
  'a child cannot check off a day whose deadline (22:00 the next day) has passed'
);
select throws_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-24') $$,
  '42501', null,
  'a child cannot check off a day that has not come yet'
);
select throws_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a2', '2026-09-23') $$,
  '42501', null,
  'a child cannot check off a sibling''s Task'
);
select throws_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000b1', '2026-09-23') $$,
  '42501', null,
  'a child cannot check off another family''s Task'
);

-- A decided Task is locked for the child.
select pg_temp.act_as_admin();
insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a3', '2026-09-22');
insert into approvals (task_id, day, approved) values
  ('70000000-0000-0000-0000-0000000000a3', '2026-09-22', true),
  ('70000000-0000-0000-0000-0000000000a3', '2026-09-23', false);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');

delete from check_offs where task_id = '70000000-0000-0000-0000-0000000000a3' and day = '2026-09-22';
select isnt_empty(
  $$ select * from check_offs where task_id = '70000000-0000-0000-0000-0000000000a3' and day = '2026-09-22' $$,
  'a child cannot undo a Check-off the parent has approved'
);
select throws_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a3', '2026-09-23') $$,
  '42501', null,
  'a child cannot check off a Task the parent has rejected'
);

-- Friday's Tasks close on Saturday at 22:00; weekends have no Tasks.
select pg_temp.set_clock('2026-09-26 21:59 Europe/Warsaw');
select lives_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-25') $$,
  'a child checks off Friday on Saturday before 22:00'
);
select throws_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-26') $$,
  '42501', null,
  'a child cannot check off a weekend day'
);
select pg_temp.set_clock('2026-09-26 22:00 Europe/Warsaw');
delete from check_offs where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-09-25';
select isnt_empty(
  $$ select * from check_offs where task_id = '70000000-0000-0000-0000-0000000000a1' and day = '2026-09-25' $$,
  'from Saturday 22:00 a child can no longer undo Friday'
);
select pg_temp.set_clock('2026-09-23 10:00 Europe/Warsaw');

-- Ben has no open Contract.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a2', '2026-09-23') $$,
  '42501', null,
  'a child without an open Contract cannot check off'
);

-- A Task added today does not count on earlier days.
select pg_temp.act_as_admin();
insert into tasks (id, child_id, name, icon, active_from) values
  ('70000000-0000-0000-0000-0000000000a4', 'c0000000-0000-0000-0000-0000000000a1', 'Make the bed', 'bed', '2026-09-23');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into check_offs (task_id, day) values ('70000000-0000-0000-0000-0000000000a4', '2026-09-22') $$,
  '42501', null,
  'a child cannot check off a Task on a day before it was added'
);

select * from finish();
rollback;
