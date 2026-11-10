-- Creates a household with its first member. It starts with the three base categories.
-- Run in the Supabase dashboard's SQL editor. Fill in the two values below. The person must have
-- an account (Authentication > Invite user) and must not belong to a household yet.
do $$
declare
  household_name text := 'Hogar de ...';
  first_member_email text := 'someone@example.com';
  member_id uuid;
  new_household uuid;
begin
  select id into member_id from auth.users where email = lower(btrim(first_member_email));
  if member_id is null then
    raise exception 'No account with email %', first_member_email;
  end if;
  if exists (select 1 from public.household_members where user_id = member_id) then
    raise exception '% already belongs to a household; use move-member.sql', first_member_email;
  end if;
  insert into public.households (name) values (btrim(household_name)) returning id into new_household;
  insert into public.household_members (user_id, household_id) values (member_id, new_household);
  raise notice 'Created "%" with % as its first member', household_name, first_member_email;
end;
$$;
