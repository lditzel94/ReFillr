-- Removes a person from their household. Unlike "Sacar" in the app, this works on the admin too.
-- The account stays; they see "no household" until someone adds them again. If they were the last
-- member, the household is deleted with its categories and items.
-- Run in the Supabase dashboard's SQL editor. Fill in the email.
do $$
declare
  member_email text := 'member@example.com';
  member_id uuid;
  household uuid;
begin
  select m.user_id, m.household_id into member_id, household
  from public.household_members m join auth.users u on u.id = m.user_id
  where u.email = lower(btrim(member_email));
  if member_id is null then
    raise exception '% does not belong to a household', member_email;
  end if;
  delete from public.household_members where user_id = member_id;
  if not exists (select 1 from public.household_members where household_id = household) then
    delete from public.households where id = household;
    raise notice 'The household had no one left and was deleted';
  end if;
  raise notice '% was removed from their household', member_email;
end;
$$;
