-- Moves a person from their household to someone else's. Like leaving from the app, if they were
-- the last member, their old household is deleted with its categories and items.
-- Run in the Supabase dashboard's SQL editor. Fill in the two emails.
do $$
declare
  member_email text := 'member@example.com';
  target_member_email text := 'other@example.com';
  member_id uuid;
  old_household uuid;
  new_household uuid;
begin
  select m.user_id, m.household_id into member_id, old_household
  from public.household_members m join auth.users u on u.id = m.user_id
  where u.email = lower(btrim(member_email));
  if member_id is null then
    raise exception '% does not belong to a household; use add-member.sql', member_email;
  end if;
  select m.household_id into new_household
  from public.household_members m join auth.users u on u.id = m.user_id
  where u.email = lower(btrim(target_member_email));
  if new_household is null then
    raise exception '% does not belong to a household', target_member_email;
  end if;
  if new_household = old_household then
    raise exception 'Both already share a household';
  end if;
  update public.household_members set household_id = new_household, joined_at = now()
  where user_id = member_id;
  if not exists (select 1 from public.household_members where household_id = old_household) then
    delete from public.households where id = old_household;
    raise notice 'Their old household had no one left and was deleted';
  end if;
  raise notice '% moved to the household of %', member_email, target_member_email;
end;
$$;
