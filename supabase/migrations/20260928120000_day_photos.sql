-- Photo of the day: a child may add one optional photo to a School day of
-- their open Contract. It never earns, blocks or changes a Star. The child can
-- replace or remove it in the Check-off window (until 22:00 the next day); only
-- the child and their parent can see it; the Payout deletes it.
--
-- The picture lives in the private Storage bucket day-photos at
-- <child_id>/<YYYY-MM-DD>.jpg. A day_photos row says the day has one and when
-- it was added, so screens don't have to list Storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('day-photos', 'day-photos', false, 1048576, array['image/jpeg']);

create table public.day_photos (
  child_id uuid not null references public.children on delete cascade,
  day date not null,
  added_at timestamptz not null default now(),
  primary key (child_id, day)
);

alter table public.day_photos enable row level security;

-- Whether the signed-in child may add, replace or remove their photo of this
-- day: a School day of their open Contract, not in the future, before the
-- Check-off deadline.
create function private.child_may_change_photo(p_child_id uuid, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_child_id = private.my_child_id()
    and private.is_school_day(p_day)
    and p_day <= private.today()
    and private.clock() < private.check_off_deadline(p_day)
    and exists (
      select 1 from public.contracts c
      where c.child_id = p_child_id and c.closed_on is null
        and p_day between c.starts_on and c.ends_on
    )
$$;

create policy "see visible children's photos" on public.day_photos for select to authenticated
  using (child_id in (select private.visible_child_ids()));

create policy "a child adds their photo" on public.day_photos for insert to authenticated
  with check (private.child_may_change_photo(child_id, day));

create policy "a child replaces their photo" on public.day_photos for update to authenticated
  using (private.child_may_change_photo(child_id, day))
  with check (private.child_may_change_photo(child_id, day));

create policy "a child removes their photo" on public.day_photos for delete to authenticated
  using (private.child_may_change_photo(child_id, day));

-- The Payout deletes the Contract's photo rows; the server action then removes
-- the pictures through the Storage API, which SQL can't do.
create function private.forget_paid_out_photos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.day_photos
  where child_id = new.child_id and day between new.starts_on and new.ends_on;
  return new;
end $$;

create trigger forget_paid_out_photos
  after update of closed_on on public.contracts
  for each row when (old.closed_on is null and new.closed_on is not null)
  execute function private.forget_paid_out_photos();

-- Storage ---------------------------------------------------------------------

-- The child and day of an object name "<child_id>/<YYYY-MM-DD>.jpg", or nulls
-- for any other name.
create function private.day_photo_child(p_name text) returns uuid
language sql immutable as $$
  select case when p_name ~ '^[0-9a-f-]{36}/\d{4}-\d{2}-\d{2}\.jpg$' then split_part(p_name, '/', 1)::uuid end
$$;

create function private.day_photo_day(p_name text) returns date
language sql immutable as $$
  select case when p_name ~ '^[0-9a-f-]{36}/\d{4}-\d{2}-\d{2}\.jpg$' then substr(split_part(p_name, '/', 2), 1, 10)::date end
$$;

-- A parent may remove a picture of their child once its day is not in an open
-- Contract: after the Payout.
create function private.parent_may_remove_photo(p_child_id uuid, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_my_child(p_child_id)
    and not exists (
      select 1 from public.contracts c
      where c.child_id = p_child_id and c.closed_on is null
        and p_day between c.starts_on and c.ends_on
    )
$$;

create policy "see visible children's photo files" on storage.objects for select to authenticated
  using (bucket_id = 'day-photos'
    and private.day_photo_child(name) in (select private.visible_child_ids()));

create policy "a child uploads their photo file" on storage.objects for insert to authenticated
  with check (bucket_id = 'day-photos'
    and private.child_may_change_photo(private.day_photo_child(name), private.day_photo_day(name)));

create policy "a child replaces their photo file" on storage.objects for update to authenticated
  using (bucket_id = 'day-photos'
    and private.child_may_change_photo(private.day_photo_child(name), private.day_photo_day(name)))
  with check (bucket_id = 'day-photos'
    and private.child_may_change_photo(private.day_photo_child(name), private.day_photo_day(name)));

create policy "a child or, after the Payout, a parent removes a photo file" on storage.objects for delete to authenticated
  using (bucket_id = 'day-photos'
    and (private.child_may_change_photo(private.day_photo_child(name), private.day_photo_day(name))
      or private.parent_may_remove_photo(private.day_photo_child(name), private.day_photo_day(name))));
