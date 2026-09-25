-- Join codes: the parent issues a short single-use code; the child types it into
-- the installed app and the server exchanges it for a session.
-- The clock is frozen at Wednesday 23 September 2026, 10:00 in Warsaw.
begin;
select plan(13);
\ir _fixtures.psql

create temp table issued (code text);
grant all on issued to authenticated, service_role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
select lives_ok(
  $$ insert into issued select issue_join_code('c0000000-0000-0000-0000-0000000000a2') $$,
  'a parent issues a Join code for their child'
);
select matches(
  (select code from issued),
  '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$',
  'a Join code is 8 characters that are easy to read and type'
);
select throws_ok(
  $$ select issue_join_code('c0000000-0000-0000-0000-0000000000b1') $$,
  '42501', null,
  'a parent cannot issue a Join code for another family''s child'
);
select is_empty('select * from join_codes', 'nobody can read Join codes through the API');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select issue_join_code('c0000000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'a child cannot issue a Join code'
);
select throws_ok(
  $$ select * from redeem_join_code('AAAAAAAA') $$,
  '42501', null,
  'only the server can redeem a Join code'
);

-- The server redeems with the secret key.
select pg_temp.act_as_admin();
select set_config('role', 'service_role', true);
select results_eq(
  $$ select child_id from redeem_join_code(lower((select substr(code, 1, 4) || '-' || substr(code, 5) from issued))) $$,
  $$ values ('c0000000-0000-0000-0000-0000000000a2'::uuid) $$,
  'the server redeems a Join code typed in lower case with a dash'
);
select is_empty(
  $$ select * from redeem_join_code((select code from issued)) $$,
  'a Join code works only once'
);
select is_empty(
  $$ select * from redeem_join_code('ZZZZZZZZ') $$,
  'an unknown Join code does not work'
);

-- Codes expire after 15 minutes.
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
truncate issued;
insert into issued select issue_join_code('c0000000-0000-0000-0000-0000000000a2');
select pg_temp.set_clock('2026-09-23 10:15 Europe/Warsaw');
select set_config('role', 'service_role', true);
select is_empty(
  $$ select * from redeem_join_code((select code from issued)) $$,
  'a Join code expires after 15 minutes'
);

-- A new code replaces the child's earlier unused one.
select pg_temp.set_clock('2026-09-23 10:00 Europe/Warsaw');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
truncate issued;
insert into issued select issue_join_code('c0000000-0000-0000-0000-0000000000a2');
insert into issued select issue_join_code('c0000000-0000-0000-0000-0000000000a2');
select set_config('role', 'service_role', true);
select is_empty(
  $$ select * from redeem_join_code((select code from issued limit 1)) $$,
  'issuing a new Join code cancels the earlier one'
);
select results_eq(
  $$ select child_id from redeem_join_code((select code from issued offset 1)) $$,
  $$ values ('c0000000-0000-0000-0000-0000000000a2'::uuid) $$,
  'the newest Join code works'
);

-- Re-connecting a device: Ada has joined before, so the server signs her into the same account.
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
truncate issued;
insert into issued select issue_join_code('c0000000-0000-0000-0000-0000000000a1');
select set_config('role', 'service_role', true);
select results_eq(
  $$ select child_id, user_id from redeem_join_code((select code from issued)) $$,
  $$ values ('c0000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'a Join code for a child who joined before returns their existing account'
);

select * from finish();
rollback;
