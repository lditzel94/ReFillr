-- Adds an account to someone's household. The household is found through one of its members, so
-- there are no ids to copy. Run in the Supabase dashboard's SQL editor. Fill in the two emails.
-- The new member must have an account (Authentication > Invite user) and no household yet.
do $$
declare
  new_member_email text := 'new@example.com';
  existing_member_email text := 'member@example.com';
  new_member uuid;
  household uuid;
begin
  select id into new_member from auth.users where email = lower(btrim(new_member_email));
  if new_member is null then
    raise exception 'No account with email %', new_member_email;
  end if;
  select m.household_id into household
  from public.household_members m join auth.users u on u.id = m.user_id
  where u.email = lower(btrim(existing_member_email));
  if household is null then
    raise exception '% does not belong to a household', existing_member_email;
  end if;
  if exists (select 1 from public.household_members where user_id = new_member) then
    raise exception '% already belongs to a household; use move-member.sql', new_member_email;
  end if;
  insert into public.household_members (user_id, household_id) values (new_member, household);
  raise notice '% joined the household of %', new_member_email, existing_member_email;
end;
$$;
