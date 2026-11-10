-- ReFillr schema: households, their members and their stock.
--
-- Access control lives here, not in the app: Row Level Security lets a person read and write only
-- what belongs to their own household. Actions with rules of their own (adjusting a quantity,
-- removing a member, leaving) are functions the app calls over RPC. Terms follow GLOSSARY.md.

-- Helpers that must not be callable over the API live in a schema PostgREST does not expose.
create schema private;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  -- Start of the current shopping cycle. A visual reference only.
  cycle_start timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- One row per member. user_id is the primary key: a person belongs to exactly one household.
create table public.household_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index household_members_household_id_idx on public.household_members (household_id);

-- What other members of the household see: name and email. Created with the account
-- (see private.create_profile).
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '' check (length(display_name) <= 60)
);

-- The admin creates accounts and sets up households, and no member can remove them.
-- Rows are only ever written by hand (supabase/scripts/make-admin.sql).
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  -- Despensa, Baño and Limpieza: created with every household, never renamed or deleted.
  is_base boolean not null default false,
  -- Display order: base categories first, then the household's own in creation order.
  position bigint generated always as identity,
  created_at timestamptz not null default now(),
  -- Lets items reference (id, household_id) so an item can't point at another household's category.
  unique (id, household_id)
);
create unique index categories_name_per_household_idx
  on public.categories (household_id, lower(btrim(name)));

create table public.items (
  -- Generated on the phone, so creating an item offline and retrying never duplicates it.
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  unit text not null check (length(btrim(unit)) between 1 and 30),
  monthly_usage integer not null check (monthly_usage between 0 and 999),
  current_qty integer not null check (current_qty between 0 and 999),
  -- Set by private.stamp_item, never by the client.
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  -- A category with items can't be deleted. NO ACTION (not RESTRICT) is checked at the end of the
  -- statement, so deleting a whole household can still cascade to both tables.
  foreign key (category_id, household_id)
    references public.categories (id, household_id) on delete no action
);
create index items_household_id_idx on public.items (household_id);
create index items_category_id_idx on public.items (category_id, household_id);

-- Changes already applied by the RPCs below, so a retried change (offline queue) applies once.
create table private.applied_changes (
  change_id uuid primary key,
  applied_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- The caller's household, or null. security definer so policies can use it without recursing
-- into household_members' own policy.
create function private.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_members where user_id = (select auth.uid());
$$;

create function private.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = p_user_id);
$$;

grant usage on schema private to authenticated;
grant execute on function private.my_household_id() to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------

-- Every account gets a profile. The invite screen fills in the name later.
create function private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(btrim(new.raw_user_meta_data ->> 'display_name'), '')
  );
  return new;
end;
$$;

create trigger create_profile
  after insert on auth.users
  for each row execute function private.create_profile();

-- Every household starts with the three base categories, in this order.
create function private.create_base_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (household_id, name, is_base)
  values (new.id, 'Despensa', true), (new.id, 'Baño', true), (new.id, 'Limpieza', true);
  return new;
end;
$$;

create trigger create_base_categories
  after insert on public.households
  for each row execute function private.create_base_categories();

-- Base categories can't be renamed or deleted, except when their whole household is deleted.
create function private.protect_base_categories()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.is_base and (new.name is distinct from old.name or not new.is_base) then
      raise exception 'base categories cannot be renamed' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if old.is_base and exists (select 1 from public.households where id = old.household_id) then
    raise exception 'base categories cannot be deleted' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger protect_base_categories
  before update or delete on public.categories
  for each row execute function private.protect_base_categories();

-- Who changed an item and when come from the server, never from the client.
create function private.stamp_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

create trigger stamp_item
  before insert or update on public.items
  for each row execute function private.stamp_item();

-- ---------------------------------------------------------------------------------------------
-- Privileges: the API roles get only the columns they may write. RLS then picks the rows.
-- ---------------------------------------------------------------------------------------------

revoke all on public.households, public.household_members, public.profiles, public.app_admins,
  public.categories, public.items from anon, authenticated;

grant select on public.households, public.household_members, public.profiles, public.app_admins,
  public.categories, public.items to authenticated;

grant update (cycle_start) on public.households to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert (id, household_id, name) on public.categories to authenticated;
grant update (name) on public.categories to authenticated;
grant delete on public.categories to authenticated;
grant insert (id, household_id, category_id, name, unit, monthly_usage, current_qty)
  on public.items to authenticated;
grant update (category_id, name, unit, monthly_usage, current_qty) on public.items to authenticated;
grant delete on public.items to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;

create policy "members read their household" on public.households
  for select to authenticated using (id = (select private.my_household_id()));
create policy "members start a new cycle" on public.households
  for update to authenticated
  using (id = (select private.my_household_id()))
  with check (id = (select private.my_household_id()));

create policy "members read their household's members" on public.household_members
  for select to authenticated using (household_id = (select private.my_household_id()));

create policy "people read their own and their household's profiles" on public.profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or user_id in (
      select user_id from public.household_members
      where household_id = (select private.my_household_id())
    )
  );
create policy "people rename themselves" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Members see whether someone in their household is the admin, to hide "Sacar" for them.
create policy "members see the admin in their household" on public.app_admins
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or user_id in (
      select user_id from public.household_members
      where household_id = (select private.my_household_id())
    )
  );

create policy "members read categories" on public.categories
  for select to authenticated using (household_id = (select private.my_household_id()));
create policy "members create categories" on public.categories
  for insert to authenticated with check (household_id = (select private.my_household_id()));
create policy "members rename categories" on public.categories
  for update to authenticated
  using (household_id = (select private.my_household_id()))
  with check (household_id = (select private.my_household_id()));
create policy "members delete categories" on public.categories
  for delete to authenticated using (household_id = (select private.my_household_id()));

create policy "members read items" on public.items
  for select to authenticated using (household_id = (select private.my_household_id()));
create policy "members create items" on public.items
  for insert to authenticated with check (household_id = (select private.my_household_id()));
create policy "members edit items" on public.items
  for update to authenticated
  using (household_id = (select private.my_household_id()))
  with check (household_id = (select private.my_household_id()));
create policy "members delete items" on public.items
  for delete to authenticated using (household_id = (select private.my_household_id()));

-- ---------------------------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------------------------

-- Adds delta to an item's current quantity, clamped to 0..999. Atomic, so two "-1" sent at the
-- same time make -2. A change_id already applied is ignored and the item comes back as it is.
create function public.adjust_qty(p_item_id uuid, p_delta integer, p_change_id uuid)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.items;
begin
  insert into private.applied_changes (change_id) values (p_change_id) on conflict do nothing;
  if found then
    update public.items
      set current_qty = least(999, greatest(0, current_qty + p_delta))
      where id = p_item_id and household_id = private.my_household_id()
      returning * into result;
  else
    select * into result from public.items
      where id = p_item_id and household_id = private.my_household_id();
  end if;
  if result.id is null then
    raise exception 'item not found' using errcode = 'no_data_found';
  end if;
  return result;
end;
$$;

-- Restock: the current quantity goes back up to the monthly usage (never down).
create function public.restock(p_item_id uuid, p_change_id uuid)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.items;
begin
  insert into private.applied_changes (change_id) values (p_change_id) on conflict do nothing;
  if found then
    update public.items
      set current_qty = greatest(current_qty, monthly_usage)
      where id = p_item_id and household_id = private.my_household_id()
      returning * into result;
  else
    select * into result from public.items
      where id = p_item_id and household_id = private.my_household_id();
  end if;
  if result.id is null then
    raise exception 'item not found' using errcode = 'no_data_found';
  end if;
  return result;
end;
$$;

-- A member removes someone else from their own household. Never the admin.
create function public.remove_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.my_household_id();
begin
  if household is null then
    raise exception 'not a member of a household' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'use leave_household to leave' using errcode = 'check_violation';
  end if;
  if private.is_admin(p_user_id) then
    raise exception 'the admin cannot be removed' using errcode = 'insufficient_privilege';
  end if;
  delete from public.household_members where user_id = p_user_id and household_id = household;
  if not found then
    raise exception 'not a member of your household' using errcode = 'no_data_found';
  end if;
end;
$$;

-- The caller leaves their household. The last member to leave takes the household with them,
-- along with its categories and items.
create function public.leave_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.my_household_id();
begin
  if household is null then
    return;
  end if;
  delete from public.household_members where user_id = (select auth.uid());
  if not exists (select 1 from public.household_members where household_id = household) then
    delete from public.households where id = household;
  end if;
end;
$$;

revoke execute on function public.adjust_qty(uuid, integer, uuid), public.restock(uuid, uuid),
  public.remove_member(uuid), public.leave_household() from public, anon;
grant execute on function public.adjust_qty(uuid, integer, uuid), public.restock(uuid, uuid),
  public.remove_member(uuid), public.leave_household() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Realtime: members get each other's changes as they happen (RLS still decides who sees what).
-- ---------------------------------------------------------------------------------------------

alter publication supabase_realtime
  add table public.households, public.household_members, public.items, public.categories;
