-- A fake family for local development, CI and the gwiazdka-preview project.
-- Never put the real family here: it goes into production once, by hand.
--
-- Parent sign-in: parent@example.com / password
-- The children have not joined on a device yet; that happens with a Join code.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'parent@example.com',
  extensions.crypt('password', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
values (
  gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"parent@example.com","email_verified":true}',
  'email', now(), now(), now()
);

insert into public.families (id) values ('22222222-2222-2222-2222-222222222222');
insert into public.parents (user_id, family_id)
  values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

insert into public.children (id, family_id, name) values
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222222', 'Ola'),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222222', 'Kuba');

insert into public.tasks (child_id, name, icon, position, active_from)
select child_id, name, icon, position, current_date - 60
from (values
  ('33333333-3333-3333-3333-333333333301'::uuid, 'Brush teeth', 'tooth', 1),
  ('33333333-3333-3333-3333-333333333301'::uuid, 'Pack school bag', 'backpack', 2),
  ('33333333-3333-3333-3333-333333333301'::uuid, 'Read 20 minutes', 'book', 3),
  ('33333333-3333-3333-3333-333333333301'::uuid, 'Practise piano', 'music', 4),
  ('33333333-3333-3333-3333-333333333302'::uuid, 'Brush teeth', 'tooth', 1),
  ('33333333-3333-3333-3333-333333333302'::uuid, 'Make the bed', 'bed', 2),
  ('33333333-3333-3333-3333-333333333302'::uuid, 'Homework', 'pencil', 3)
) as t(child_id, name, icon, position);

-- Open Contracts that stay valid whenever the seed runs.
insert into public.contracts (child_id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars) values
  ('33333333-3333-3333-3333-333333333301', current_date - 30, current_date + 150, 50, 3),
  ('33333333-3333-3333-3333-333333333302', current_date - 30, current_date + 150, 50, 3);

-- A few decided days so the screens have something to show.
insert into public.check_offs (task_id, day)
select t.id, d::date
from public.tasks t
cross join generate_series(current_date - 14, current_date - 1, interval '1 day') d
where extract(isodow from d) between 1 and 5 and t.position <= 2;

insert into public.approvals (task_id, day, approved)
select task_id, day, position <> 2 or extract(isodow from day) <> 3
from public.check_offs join public.tasks on tasks.id = check_offs.task_id
where day < current_date - 3;
