-- Template for adding the real family to production, once, by hand.
-- Copy it into the Supabase dashboard's SQL editor for the Gwiazdki project,
-- replace the placeholders, and run it. Never commit the filled-in copy.
--
-- Before running: create the parent's account in the dashboard under
-- Authentication → Users → Add user (email + password, "Auto Confirm User" on).

do $$
declare
  parent_email constant text := 'PARENT_EMAIL';        -- the account you just created
  family uuid := gen_random_uuid();
  first_child uuid := gen_random_uuid();
  second_child uuid := gen_random_uuid();
begin
  insert into public.families (id) values (family);
  insert into public.parents (user_id, family_id)
    select id, family from auth.users where email = parent_email;
  if not found then
    raise exception 'No account with email %', parent_email;
  end if;

  insert into public.children (id, family_id, name) values
    (first_child, family, 'FIRST_CHILD_NAME'),
    (second_child, family, 'SECOND_CHILD_NAME');

  -- Each child's Task list. Icons: any short name; the Today screen maps them to pictures.
  insert into public.tasks (child_id, name, icon, position, active_from) values
    (first_child, 'Brush teeth', 'tooth', 1, current_date),
    (first_child, 'Pack school bag', 'backpack', 2, current_date),
    (second_child, 'Brush teeth', 'tooth', 1, current_date),
    (second_child, 'Make the bed', 'bed', 2, current_date);

  -- One open Contract per child: dates, grosze per Star (50 = 0.50 zł), Weekly bonus size.
  insert into public.contracts (child_id, starts_on, ends_on, grosze_per_star, weekly_bonus_stars) values
    (first_child, current_date, 'END_DATE', 50, 3),
    (second_child, current_date, 'END_DATE', 50, 3);
end $$;
