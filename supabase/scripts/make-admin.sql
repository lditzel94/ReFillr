-- Marks an account as the admin: they set up households and no member can remove them.
-- Run once, in the Supabase dashboard's SQL editor, after the account exists
-- (Authentication > Users). Fill in the email below.
do $$
declare
  admin_email text := 'you@example.com';
  admin_id uuid;
begin
  select id into admin_id from auth.users where email = lower(btrim(admin_email));
  if admin_id is null then
    raise exception 'No account with email %', admin_email;
  end if;
  insert into public.app_admins (user_id) values (admin_id) on conflict do nothing;
  raise notice '% is the admin', admin_email;
end;
$$;
