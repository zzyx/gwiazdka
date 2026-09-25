begin;
select plan(7);
\ir _fixtures.psql

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
  'select grosze_per_star from contracts',
  $$ values (50) $$,
  'a child sees their own Contract, so the app can show the PLN value'
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
