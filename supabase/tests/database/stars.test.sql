-- Stars are never stored: a child's balance is computed from approved Approvals
-- inside their open Contract.
begin;
select plan(5);
\ir _fixtures.psql

-- Ada: two approved and one rejected in the open Contract, one approved in a closed one.
insert into contracts (child_id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars, closed_on) values
  ('c0000000-0000-0000-0000-0000000000a1', '2026-06-01', '2026-06-30', 50, 3, '2026-06-30');
insert into approvals (task_id, day, approved) values
  ('70000000-0000-0000-0000-0000000000a1', '2026-09-21', true),
  ('70000000-0000-0000-0000-0000000000a3', '2026-09-21', true),
  ('70000000-0000-0000-0000-0000000000a1', '2026-09-22', false),
  ('70000000-0000-0000-0000-0000000000a1', '2026-06-15', true);
-- Cy: one approved.
insert into approvals (task_id, day, approved) values
  ('70000000-0000-0000-0000-0000000000b1', '2026-09-21', true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select results_eq(
  'select stars, grosze_per_star from star_balances',
  $$ values (2, 50) $$,
  'a child sees their Star balance in the open Contract, with its rate for the PLN value'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
select results_eq(
  'select c.name, b.stars from star_balances b join children c on c.id = b.child_id order by c.name',
  $$ values ('Ada'::text, 2) $$,
  'a parent sees each child''s balance in the open Contract; Ben has no open Contract'
);
update approvals set approved = false where task_id = '70000000-0000-0000-0000-0000000000a3' and day = '2026-09-21';
select results_eq(
  'select stars from star_balances',
  $$ values (1) $$,
  'rejecting an approved Task takes its Star away'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select results_eq(
  'select stars from star_balances',
  $$ values (1) $$,
  'another family''s child sees only their own balance'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ insert into approvals (task_id, day, approved) values ('70000000-0000-0000-0000-0000000000a1', '2026-09-23', true) $$,
  '42501', null,
  'a child cannot give themselves a Star'
);

select * from finish();
rollback;
