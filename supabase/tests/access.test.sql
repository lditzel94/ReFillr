-- Access rules and RPCs, run with `npx supabase test db` against a local Supabase.
--
-- Two households: A (Ana, the admin, and Beto) and B (Caro). Each block acts as one of them by
-- switching to the `authenticated` role with that person's id in the JWT claims, the same way
-- PostgREST does for a real request.
begin;
select plan(43);

-- ---------------------------------------------------------------------------------------------
-- Setup, as the database owner (RLS doesn't apply)
-- ---------------------------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"display_name": "Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'beto@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'caro@example.com', '{"display_name": "Caro"}');

insert into public.app_admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

insert into public.households (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Hogar A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Hogar B');

insert into public.household_members (user_id, household_id) values
  ('00000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000000c', 'bbbbbbbb-0000-0000-0000-000000000000');

insert into public.items (id, household_id, category_id, name, unit, monthly_usage, current_qty)
select 'bbbbbbbb-1111-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', id,
  'Yerba', 'paquetes', 4, 1
from public.categories
where household_id = 'bbbbbbbb-0000-0000-0000-000000000000' and name = 'Despensa';

select results_eq(
  $$ select display_name from public.profiles order by user_id $$,
  $$ values ('Ana'), (''), ('Caro') $$,
  'every account gets a profile, named from the invite metadata when present'
);

select results_eq(
  $$ select name from public.categories
     where household_id = 'aaaaaaaa-0000-0000-0000-000000000000' and is_base order by position $$,
  $$ values ('Despensa'), ('Baño'), ('Limpieza') $$,
  'a new household starts with the three base categories, in order'
);

-- ---------------------------------------------------------------------------------------------
-- Beto, a member of household A
-- ---------------------------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);
set local role authenticated;

select results_eq($$ select name from public.households $$, $$ values ('Hogar A') $$,
  'a member sees only their own household');
select is((select count(*)::int from public.household_members), 2,
  'a member sees only their household''s members');
select is((select count(*)::int from public.profiles), 2,
  'a member sees only their own and their household''s profiles');
select is((select count(*)::int from public.app_admins), 1,
  'a member sees that the admin is in their household');
select is((select count(*)::int from public.categories), 3,
  'a member sees only their household''s categories');
select is((select count(*)::int from public.items), 0,
  'a member does not see another household''s items');

select lives_ok(
  $$ insert into public.items (id, household_id, category_id, name, unit, monthly_usage, current_qty)
     select 'aaaaaaaa-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', id,
       'Leche', 'cartones', 12, 2
     from public.categories where name = 'Despensa' $$,
  'a member creates an item in their household'
);
select is((select updated_by from public.items where name = 'Leche'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'the server stamps who changed the item');

select throws_ok(
  $$ insert into public.items (household_id, category_id, name, unit, monthly_usage, current_qty)
     select 'bbbbbbbb-0000-0000-0000-000000000000', id, 'Intruso', 'u', 1, 0
     from public.categories where name = 'Despensa' $$,
  '42501', null, 'a member cannot create items in another household'
);
select throws_ok(
  $$ insert into public.items (household_id, category_id, name, unit, monthly_usage, current_qty, updated_by)
     select 'aaaaaaaa-0000-0000-0000-000000000000', id, 'Firmado', 'u', 1, 0,
       '00000000-0000-0000-0000-00000000000a'
     from public.categories where name = 'Despensa' $$,
  '42501', null, 'the client cannot set updated_by'
);
select throws_ok(
  $$ update public.items set current_qty = 1000 where name = 'Leche' $$,
  '23514', null, 'quantities stay within 0..999'
);
select results_eq(
  $$ with changed as (
       update public.items set current_qty = 0 where id = 'bbbbbbbb-1111-0000-0000-000000000000'
       returning 1)
     select count(*)::int from changed $$,
  $$ values (0) $$, 'a member cannot edit another household''s items'
);

-- Quantities through the RPCs
select is((public.adjust_qty('aaaaaaaa-1111-0000-0000-000000000000', -1, '10000000-0000-0000-0000-000000000001')).current_qty,
  1, 'adjust_qty subtracts');
select is((public.adjust_qty('aaaaaaaa-1111-0000-0000-000000000000', -1, '10000000-0000-0000-0000-000000000002')).current_qty,
  0, 'two different -1 changes add up');
select is((public.adjust_qty('aaaaaaaa-1111-0000-0000-000000000000', -1, '10000000-0000-0000-0000-000000000003')).current_qty,
  0, 'adjust_qty never goes below 0');
select is((public.adjust_qty('aaaaaaaa-1111-0000-0000-000000000000', 5, '10000000-0000-0000-0000-000000000004')).current_qty,
  5, 'adjust_qty adds');
select is((public.adjust_qty('aaaaaaaa-1111-0000-0000-000000000000', 5, '10000000-0000-0000-0000-000000000004')).current_qty,
  5, 'a retried change_id is applied only once');
select is((public.restock('aaaaaaaa-1111-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005')).current_qty,
  12, 'restock brings the item back to its monthly usage');
select is((public.adjust_qty('aaaaaaaa-1111-0000-0000-000000000000', 3, '10000000-0000-0000-0000-000000000006')).current_qty,
  15, 'an item can hold more than its monthly usage');
select is((public.restock('aaaaaaaa-1111-0000-0000-000000000000', '10000000-0000-0000-0000-000000000007')).current_qty,
  15, 'restock never lowers the quantity');
select throws_ok(
  $$ select public.adjust_qty('bbbbbbbb-1111-0000-0000-000000000000', -1, '10000000-0000-0000-0000-000000000008') $$,
  'P0002', null, 'adjust_qty cannot touch another household''s items'
);
select throws_ok(
  $$ select public.adjust_qty('aaaaaaaa-9999-0000-0000-000000000000', -1, '10000000-0000-0000-0000-000000000009') $$,
  'P0002', null, 'adjust_qty on a deleted item says the item is gone'
);

-- Categories
select throws_ok($$ update public.categories set name = 'Comida' where name = 'Despensa' $$,
  '23514', null, 'a base category cannot be renamed');
select throws_ok($$ delete from public.categories where name = 'Limpieza' $$,
  '23514', null, 'a base category cannot be deleted');
select lives_ok(
  $$ insert into public.categories (household_id, name)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'Mascotas') $$,
  'a member creates a category');
select throws_ok(
  $$ insert into public.categories (household_id, name)
     values ('aaaaaaaa-0000-0000-0000-000000000000', ' mascotas ') $$,
  '23505', null, 'category names are unique per household, ignoring case and spaces');
select throws_ok(
  $$ insert into public.categories (household_id, name, is_base)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'Falsa base', true) $$,
  '42501', null, 'the client cannot create a base category');
select lives_ok($$ update public.categories set name = 'Mascota' where name = 'Mascotas' $$,
  'a member renames their own category');
select lives_ok($$ update public.items set category_id = (select id from public.categories where name = 'Mascota') $$,
  'an item moves to another category');
select throws_ok($$ delete from public.categories where name = 'Mascota' $$,
  '23503', null, 'a category with items cannot be deleted');

-- Household and people
select throws_ok($$ update public.households set name = 'Otro nombre' $$,
  '42501', null, 'a member cannot rename the household');
select lives_ok($$ update public.households set cycle_start = now() $$,
  'a member starts a new cycle');
select lives_ok($$ update public.profiles set display_name = 'Beto' where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  'a person sets their own name');
select results_eq(
  $$ with changed as (
       update public.profiles set display_name = 'X' where user_id = '00000000-0000-0000-0000-00000000000a'
       returning 1)
     select count(*)::int from changed $$,
  $$ values (0) $$, 'a person cannot rename someone else');
select throws_ok(
  $$ insert into public.household_members (user_id, household_id)
     values ('00000000-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000000') $$,
  '42501', null, 'members are not added from the app');
select throws_ok($$ select public.remove_member('00000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'nobody can remove the admin');
select throws_ok($$ select public.remove_member('00000000-0000-0000-0000-00000000000c') $$,
  'P0002', null, 'a member cannot remove someone from another household');

-- ---------------------------------------------------------------------------------------------
-- Ana, the admin, removes Beto
-- ---------------------------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$ select public.remove_member('00000000-0000-0000-0000-00000000000b') $$,
  'the admin removes a member');

reset role;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.items), 0, 'a removed member no longer sees the items');

-- ---------------------------------------------------------------------------------------------
-- Caro, the last member of household B, leaves
-- ---------------------------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok($$ select public.leave_household() $$, 'the last member leaves');

reset role;
select is(
  (select count(*)::int from public.households where id = 'bbbbbbbb-0000-0000-0000-000000000000')
  + (select count(*)::int from public.categories where household_id = 'bbbbbbbb-0000-0000-0000-000000000000')
  + (select count(*)::int from public.items where household_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  0, 'when the last member leaves, the household goes with its categories and items');

select * from finish();
rollback;
