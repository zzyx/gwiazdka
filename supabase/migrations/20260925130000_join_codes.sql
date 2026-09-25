-- Join codes: a child signs in on their own device by typing a short single-use
-- code the parent issued, inside the installed app. Only a hash of the code is
-- stored. The server redeems it with the secret key and turns it into a session.

create table public.join_codes (
  code_hash text primary key,
  child_id uuid not null references public.children on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index join_codes_child_id on public.join_codes (child_id);

-- No policies: nobody reads or writes Join codes through the API directly.
alter table public.join_codes enable row level security;

-- Upper-case letters and digits, without the look-alikes 0/O, 1/I/L.
create function private.join_code_alphabet() returns text
language sql immutable as $$ select 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' $$;

create function private.hash_join_code(p_code text) returns text
language sql immutable as $$
  select encode(extensions.digest(upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$$;

-- A parent issues a Join code for one of their children. It works once, for
-- 15 minutes, and cancels any earlier unused code for that child.
create function public.issue_join_code(p_child_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := private.join_code_alphabet();
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  if not exists (
    select 1 from public.children
    where id = p_child_id and family_id = private.my_family_id()
  ) then
    raise exception 'not your child' using errcode = '42501';
  end if;

  for i in 0..7 loop
    code := code || substr(alphabet, 1 + get_byte(bytes, i) % length(alphabet), 1);
  end loop;

  delete from public.join_codes where child_id = p_child_id and used_at is null;
  insert into public.join_codes (code_hash, child_id, expires_at)
    values (private.hash_join_code(code), p_child_id, private.clock() + interval '15 minutes');
  return code;
end $$;

-- The server redeems a Join code: marks it used and says which child it is for,
-- and their account if they joined before. Returns no row if the code is unknown,
-- used or expired. Dashes, spaces and case are ignored.
create function public.redeem_join_code(p_code text)
returns table (child_id uuid, user_id uuid)
language sql volatile security definer set search_path = '' as $$
  update public.join_codes j
  set used_at = private.clock()
  from public.children c
  where j.code_hash = private.hash_join_code(p_code)
    and j.used_at is null
    and j.expires_at > private.clock()
    and c.id = j.child_id
  returning c.id, c.user_id
$$;

revoke execute on function public.issue_join_code(uuid) from public, anon;
revoke execute on function public.redeem_join_code(text) from public, anon, authenticated;
grant execute on function public.redeem_join_code(text) to service_role;
