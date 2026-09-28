-- Photo of the day: one optional photo per child per School day. The child
-- adds, replaces or removes it in the Check-off window; only the child and
-- their parent see it; the Payout deletes it.
begin;
select plan(24);
\ir _fixtures.psql

-- Today is Wednesday 23 September 2026, 10:00 in Warsaw.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ insert into day_photos (child_id, day) values ('c0000000-0000-0000-0000-0000000000a1', '2026-09-23') $$,
  'a child adds a photo of today'
);
select lives_ok(
  $$ insert into day_photos (child_id, day) values ('c0000000-0000-0000-0000-0000000000a1', '2026-09-22') $$,
  'a child adds a photo of yesterday before 22:00'
);
select lives_ok(
  $$ update day_photos set added_at = now() where day = '2026-09-23' $$,
  'a child replaces a photo'
);
select throws_ok(
  $$ insert into day_photos (child_id, day) values ('c0000000-0000-0000-0000-0000000000a1', '2026-09-21') $$,
  '42501', null,
  'a photo of the day before yesterday is too late'
);
select throws_ok(
  $$ insert into day_photos (child_id, day) values ('c0000000-0000-0000-0000-0000000000a1', '2026-09-24') $$,
  '42501', null,
  'a photo of tomorrow is too early'
);
select throws_ok(
  $$ insert into day_photos (child_id, day) values ('c0000000-0000-0000-0000-0000000000a1', '2026-09-20') $$,
  '42501', null,
  'a Sunday is not a School day'
);
select throws_ok(
  $$ insert into day_photos (child_id, day) values ('c0000000-0000-0000-0000-0000000000a2', '2026-09-23') $$,
  '42501', null,
  'a child cannot add a photo for a sibling'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$ insert into day_photos (child_id, day) values ('c0000000-0000-0000-0000-0000000000a2', '2026-09-23') $$,
  '42501', null,
  'a child without an open Contract cannot add a photo'
);
select is_empty('select * from day_photos', 'a sibling sees none of Ada''s photos');

select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
select results_eq(
  'select day from day_photos order by day',
  $$ values ('2026-09-22'::date), ('2026-09-23') $$,
  'the parent sees their child''s photos'
);
select throws_ok(
  $$ insert into day_photos (child_id, day) values ('c0000000-0000-0000-0000-0000000000a1', '2026-09-21') $$,
  '42501', null,
  'a parent cannot add a photo'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000b0b0');
select is_empty('select * from day_photos', 'another family''s parent sees none');

-- The window closes at 22:00 the next day.
select pg_temp.set_clock('2026-09-24 22:00 Europe/Warsaw');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is_empty(
  $$ delete from day_photos where day = '2026-09-23' returning day $$,
  'after 22:00 the next day the photo can''t be removed'
);
select lives_ok(
  $$ delete from day_photos where day = '2026-09-24' $$,
  'no error removing a photo that isn''t there'
);

-- The picture files in Storage follow the same rules. Deletes go through the
-- Storage API, which allows them like this.
select set_config('storage.allow_delete_query', 'true', true);
select pg_temp.set_clock('2026-09-23 10:00 Europe/Warsaw');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('day-photos', 'c0000000-0000-0000-0000-0000000000a1/2026-09-23.jpg') $$,
  'a child uploads a picture of today into their own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('day-photos', 'c0000000-0000-0000-0000-0000000000a1/2026-09-21.jpg') $$,
  '42501', null,
  'a picture of an old day cannot be uploaded'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('day-photos', 'c0000000-0000-0000-0000-0000000000a2/2026-09-23.jpg') $$,
  '42501', null,
  'a picture cannot go into a sibling''s folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('day-photos', 'c0000000-0000-0000-0000-0000000000a1/2026-09-23.png') $$,
  '42501', null,
  'only <child>/<day>.jpg names are allowed'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'day-photos' $$,
  $$ values ('c0000000-0000-0000-0000-0000000000a1/2026-09-23.jpg') $$,
  'the parent sees the picture'
);
select is_empty(
  $$ delete from storage.objects where bucket_id = 'day-photos' returning name $$,
  'the parent cannot remove a picture before the Payout'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000b0b0');
select is_empty(
  $$ select name from storage.objects where bucket_id = 'day-photos' $$,
  'another family''s parent sees no pictures'
);

-- The Payout forgets the Contract's photos, and the parent may then remove the pictures.
select pg_temp.act_as('00000000-0000-0000-0000-00000000a0a0');
select close_contract('c7000000-0000-0000-0000-0000000000a1');
select is_empty('select * from day_photos', 'the Payout deletes the Contract''s photos');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'day-photos' $$,
  $$ values ('c0000000-0000-0000-0000-0000000000a1/2026-09-23.jpg') $$,
  'after the Payout the parent may still find the picture to remove it'
);
select results_eq(
  $$ delete from storage.objects where bucket_id = 'day-photos' returning name $$,
  $$ values ('c0000000-0000-0000-0000-0000000000a1/2026-09-23.jpg') $$,
  'after the Payout the parent removes the picture'
);

select * from finish();
rollback;
