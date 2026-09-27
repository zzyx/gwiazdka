-- The parent decides each finished week of an open Contract: Grant or No bonus.
-- Only through decide_weekly_bonus; a granted week counts at the Contract's
-- current Weekly bonus size in the balance and in the Payout.
begin;
select plan(22);
\ir _fixtures.psql

-- Today is Wednesday 23 September 2026. Ada's Contract runs from Tuesday
-- 1 September with a Weekly bonus of 3 at 0,50 zł a Star.
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
insert into approvals (task_id, day, approved) values
  ('70000000-0000-0000-0000-0000000000a1', '2026-09-14', true);

select lives_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000a1', '2026-09-14', true) $$,
  'a parent grants the Weekly bonus for a finished week'
);
select results_eq(
  'select stars, task_stars, bonus_stars from star_balances',
  $$ values (4, 1, 3) $$,
  'a granted week adds the Contract''s Weekly bonus to the balance'
);
select lives_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000a1', '2026-09-14', false) $$,
  'a parent changes the decision to No bonus while the Contract is open'
);
select results_eq(
  $$ select week_of, granted from weekly_bonuses $$,
  $$ values ('2026-09-14'::date, false) $$,
  'one decision per week: the change replaces the earlier one'
);
select results_eq(
  'select stars, task_stars, bonus_stars from star_balances',
  $$ values (1, 1, 0) $$,
  'No bonus adds nothing'
);
select lives_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000a1', '2026-08-31', true) $$,
  'the week the Contract started in can be decided'
);

-- When a week can be decided.
select throws_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000a1', '2026-09-21', true) $$,
  'A week can be judged from its Friday.',
  'the current week can''t be decided before its Friday'
);
select pg_temp.set_clock('2026-09-25 09:00 Europe/Warsaw');
select lives_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000a1', '2026-09-21', true) $$,
  'from Friday the week can be decided, even with Check-offs still waiting'
);
select throws_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000a1', '2026-08-24', true) $$,
  'This week is not in the Contract.',
  'a week before the Contract can''t be decided'
);
select throws_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000a1', '2026-09-15', true) $$,
  'A week starts on a Monday.',
  'a week is named by its Monday'
);
select results_eq(
  'select stars, task_stars, bonus_stars from star_balances',
  $$ values (7, 1, 6) $$,
  'two granted weeks count twice'
);

-- The current size counts, like the current rate.
select pg_temp.act_as_admin();
update contracts set weekly_bonus_stars = 5 where id = 'c7000000-0000-0000-0000-0000000000a1';
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
select results_eq(
  'select bonus_stars from star_balances',
  $$ values (10) $$,
  'granted weeks count at the Contract''s current Weekly bonus size'
);

-- Who may decide, and how.
select throws_ok(
  $$ insert into weekly_bonuses (contract_id, week_of, granted)
     values ('c7000000-0000-0000-0000-0000000000a1', '2026-09-07', true) $$,
  '42501', null,
  'a parent cannot write Weekly bonuses directly'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000b0b0');
select throws_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000a1', '2026-09-07', true) $$,
  '42501', null,
  'another family''s parent cannot decide'
);
select is_empty(
  'select * from weekly_bonuses',
  'another family''s parent sees none of them'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000a1', '2026-09-07', true) $$,
  '42501', null,
  'a child cannot grant themselves a Weekly bonus'
);
select results_eq(
  'select week_of, granted from weekly_bonuses order by week_of',
  $$ values ('2026-08-31'::date, true), ('2026-09-14', false), ('2026-09-21', true) $$,
  'a child sees their own decisions'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is_empty(
  'select * from weekly_bonuses',
  'another family''s child sees none of them'
);

-- A Contract without a Weekly bonus.
select pg_temp.act_as_admin();
update contracts set weekly_bonus_stars = 0 where id = 'c7000000-0000-0000-0000-0000000000b1';
select pg_temp.act_as('00000000-0000-0000-0000-00000000b0b0');
select throws_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000b1', '2026-09-14', true) $$,
  'This Contract has no Weekly bonus.',
  'nothing to grant when the Contract has no Weekly bonus'
);

-- The Payout includes the bonuses; afterwards they are frozen.
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
select results_eq(
  $$ select task_stars, bonus_stars, amount_grosze from close_contract('c7000000-0000-0000-0000-0000000000a1') $$,
  $$ values (1, 10, 550) $$,
  'Close & pay out pays the granted Weekly bonuses at the current size and rate'
);
select throws_ok(
  $$ select decide_weekly_bonus('c7000000-0000-0000-0000-0000000000a1', '2026-09-07', true) $$,
  'This Contract is closed.',
  'a paid-out Contract''s weeks are frozen'
);
select results_eq(
  'select count(*)::int from weekly_bonuses',
  $$ values (3) $$,
  'the decisions stay for the record after the Payout'
);

select * from finish();
rollback;
