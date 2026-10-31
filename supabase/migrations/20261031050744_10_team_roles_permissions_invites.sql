-- ===== Roles: owner, manager, host, waiter, kitchen, cashier =====
alter table public.restaurant_members drop constraint restaurant_members_role_check;
update public.restaurant_members set role = 'waiter' where role = 'staff';
alter table public.restaurant_members
  add constraint restaurant_members_role_check
  check (role in ('owner', 'manager', 'host', 'waiter', 'kitchen', 'cashier'));
alter table public.restaurant_members alter column role set default 'waiter';

-- Matriz de permisos (se replica en src/lib/roles.ts para la interfaz).
create function private.has_permission(p_restaurant_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = (select auth.uid())
      and case p_permission
        when 'menu.edit'       then m.role in ('owner', 'manager')
        when 'tables.edit'     then m.role in ('owner', 'manager', 'host')
        when 'settings.edit'   then m.role in ('owner', 'manager')
        when 'team.manage'     then m.role in ('owner', 'manager')
        when 'orders.take'     then m.role in ('owner', 'manager', 'host', 'waiter')
        when 'orders.kitchen'  then m.role in ('owner', 'manager', 'kitchen', 'waiter')
        when 'orders.serve'    then m.role in ('owner', 'manager', 'host', 'waiter')
        when 'orders.cancel'   then m.role in ('owner', 'manager', 'waiter', 'kitchen')
        when 'session.close'   then m.role in ('owner', 'manager', 'host', 'waiter', 'cashier')
        when 'orders.view'     then true
        else false
      end
  );
$$;
revoke execute on function private.has_permission(uuid, text) from public, anon;
grant execute on function private.has_permission(uuid, text) to authenticated;

-- ===== Políticas por permiso (las de lectura siguen abiertas a todo el equipo) =====
drop policy restaurants_update_owner on public.restaurants;
create policy restaurants_update_settings on public.restaurants
  for update to authenticated
  using (private.has_permission(id, 'settings.edit'))
  with check (private.has_permission(id, 'settings.edit'));

drop policy dishes_insert_staff on public.dishes;
drop policy dishes_update_staff on public.dishes;
drop policy dishes_delete_staff on public.dishes;
create policy dishes_insert_menu on public.dishes
  for insert to authenticated with check (private.has_permission(restaurant_id, 'menu.edit'));
create policy dishes_update_menu on public.dishes
  for update to authenticated
  using (private.has_permission(restaurant_id, 'menu.edit'))
  with check (private.has_permission(restaurant_id, 'menu.edit'));
create policy dishes_delete_menu on public.dishes
  for delete to authenticated using (private.has_permission(restaurant_id, 'menu.edit'));

drop policy option_groups_staff_all on public.dish_option_groups;
create policy option_groups_menu_write on public.dish_option_groups
  for all to authenticated
  using (exists (select 1 from public.dishes d where d.id = dish_id and private.has_permission(d.restaurant_id, 'menu.edit')))
  with check (exists (select 1 from public.dishes d where d.id = dish_id and private.has_permission(d.restaurant_id, 'menu.edit')));
drop policy options_staff_all on public.dish_options;
create policy options_menu_write on public.dish_options
  for all to authenticated
  using (exists (
    select 1 from public.dish_option_groups g join public.dishes d on d.id = g.dish_id
    where g.id = group_id and private.has_permission(d.restaurant_id, 'menu.edit')))
  with check (exists (
    select 1 from public.dish_option_groups g join public.dishes d on d.id = g.dish_id
    where g.id = group_id and private.has_permission(d.restaurant_id, 'menu.edit')));

drop policy tables_insert_staff on public.dining_tables;
drop policy tables_update_staff on public.dining_tables;
drop policy tables_delete_staff on public.dining_tables;
create policy tables_insert_edit on public.dining_tables
  for insert to authenticated with check (private.has_permission(restaurant_id, 'tables.edit'));
create policy tables_update_edit on public.dining_tables
  for update to authenticated
  using (private.has_permission(restaurant_id, 'tables.edit'))
  with check (private.has_permission(restaurant_id, 'tables.edit'));
create policy tables_delete_edit on public.dining_tables
  for delete to authenticated using (private.has_permission(restaurant_id, 'tables.edit'));

drop policy seats_insert_staff on public.seats;
drop policy seats_update_staff on public.seats;
drop policy seats_delete_staff on public.seats;
create policy seats_insert_edit on public.seats
  for insert to authenticated
  with check (exists (select 1 from public.dining_tables t where t.id = table_id and private.has_permission(t.restaurant_id, 'tables.edit')));
create policy seats_update_edit on public.seats
  for update to authenticated
  using (exists (select 1 from public.dining_tables t where t.id = table_id and private.has_permission(t.restaurant_id, 'tables.edit')))
  with check (exists (select 1 from public.dining_tables t where t.id = table_id and private.has_permission(t.restaurant_id, 'tables.edit')));
create policy seats_delete_edit on public.seats
  for delete to authenticated
  using (exists (select 1 from public.dining_tables t where t.id = table_id and private.has_permission(t.restaurant_id, 'tables.edit')));

-- El equipo ya no se modifica directamente: solo por las funciones de abajo.
drop policy members_select on public.restaurant_members;
drop policy members_insert_owner on public.restaurant_members;
drop policy members_delete_owner on public.restaurant_members;
create policy members_select on public.restaurant_members
  for select to authenticated
  using (user_id = (select auth.uid()) or private.has_permission(restaurant_id, 'team.manage'));
revoke insert, update, delete on public.restaurant_members from authenticated;

-- ===== Funciones existentes: pasan a comprobar el permiso concreto =====
do $$
declare
  v_old text;
  v_new text;
begin
  -- add_items y update_item: "es personal" pasa a significar "puede tomar pedidos"
  foreach v_old in array array['public.add_items(uuid, jsonb, uuid, text)', 'public.update_item(uuid, jsonb)'] loop
    select pg_get_functiondef(v_old::regprocedure) into v_new;
    if position('v_is_staff := private.is_member(v_rest.id);' in v_new) = 0 then
      raise exception 'patrón no encontrado en %', v_old;
    end if;
    execute replace(v_new, 'v_is_staff := private.is_member(v_rest.id);',
                    'v_is_staff := private.has_permission(v_rest.id, ''orders.take'');');
  end loop;

  select pg_get_functiondef('public.staff_open_session(uuid)'::regprocedure) into v_new;
  if position('private.is_member(v_table.restaurant_id)' in v_new) = 0 then
    raise exception 'patrón no encontrado en staff_open_session';
  end if;
  execute replace(v_new, 'private.is_member(v_table.restaurant_id)',
                  'private.has_permission(v_table.restaurant_id, ''orders.take'')');

  select pg_get_functiondef('public.close_session(uuid)'::regprocedure) into v_new;
  if position('private.is_member(restaurant_id)' in v_new) = 0 then
    raise exception 'patrón no encontrado en close_session';
  end if;
  execute replace(v_new, 'private.is_member(restaurant_id)',
                  'private.has_permission(restaurant_id, ''session.close'')');
end $$;

-- Cada transición de estado exige su permiso (cocina prepara, sala sirve, etc.)
create or replace function public.set_items_status(p_item_ids uuid[], p_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_permission text := case p_status
    when 'preparing' then 'orders.kitchen'
    when 'ready' then 'orders.kitchen'
    when 'served' then 'orders.serve'
    when 'cancelled' then 'orders.cancel'
  end;
  v_count integer;
begin
  if v_permission is null then
    raise exception 'invalid_status';
  end if;

  update public.order_items i
  set status = p_status
  where i.id = any(p_item_ids)
    and private.has_permission(i.restaurant_id, v_permission)
    and case p_status
      when 'preparing' then i.status = 'pending'
      when 'ready' then i.status in ('pending', 'preparing')
      when 'served' then i.status in ('pending', 'preparing', 'ready')
      when 'cancelled' then i.status in ('pending', 'preparing', 'ready')
    end;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ===== Invitaciones =====
create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role text not null check (role in ('owner', 'manager', 'host', 'waiter', 'kitchen', 'cashier')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index staff_invites_pending_unique on public.staff_invites (restaurant_id, email) where accepted_at is null;
create index staff_invites_email_idx on public.staff_invites (email) where accepted_at is null;
create index staff_invites_invited_by_idx on public.staff_invites (invited_by);
alter table public.staff_invites enable row level security;
revoke all on public.staff_invites from anon, authenticated;

-- ¿Puede quien llama asignar este rol? El dueño, cualquiera; el gerente, solo roles de operación.
create function private.can_assign_role(p_restaurant_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id and m.user_id = (select auth.uid())
      and (m.role = 'owner'
           or (m.role = 'manager' and p_role in ('host', 'waiter', 'kitchen', 'cashier')))
  );
$$;
revoke execute on function private.can_assign_role(uuid, text) from public, anon, authenticated;

-- Equipo e invitaciones pendientes (con correos, que están en auth.users)
create function public.list_team(p_restaurant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission(p_restaurant_id, 'team.manage') then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'email', u.email, 'role', m.role, 'created_at', m.created_at)
        order by m.created_at)
      from public.restaurant_members m
      join auth.users u on u.id = m.user_id
      where m.restaurant_id = p_restaurant_id), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'email', i.email, 'role', i.role, 'created_at', i.created_at)
        order by i.created_at)
      from public.staff_invites i
      where i.restaurant_id = p_restaurant_id and i.accepted_at is null), '[]'::jsonb)
  );
end;
$$;

create function public.invite_member(p_restaurant_id uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_id uuid;
begin
  if not private.can_assign_role(p_restaurant_id, p_role) then
    raise exception 'forbidden';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  if exists (
    select 1 from public.restaurant_members m join auth.users u on u.id = m.user_id
    where m.restaurant_id = p_restaurant_id and lower(u.email) = v_email) then
    raise exception 'already_member';
  end if;

  insert into public.staff_invites (restaurant_id, email, role, invited_by)
  values (p_restaurant_id, v_email, p_role, (select auth.uid()))
  on conflict (restaurant_id, email) where accepted_at is null do update set role = excluded.role
  returning id into v_id;
  return v_id;
end;
$$;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.staff_invites;
begin
  select * into v_inv from public.staff_invites where id = p_invite_id and accepted_at is null;
  if not found or not private.can_assign_role(v_inv.restaurant_id, v_inv.role) then
    raise exception 'forbidden';
  end if;
  delete from public.staff_invites where id = p_invite_id;
end;
$$;

create function public.set_member_role(p_restaurant_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  select role into v_current from public.restaurant_members
  where restaurant_id = p_restaurant_id and user_id = p_user_id;
  -- Hay que poder asignar tanto el rol nuevo como administrar el actual
  if not found
     or not private.can_assign_role(p_restaurant_id, p_role)
     or not private.can_assign_role(p_restaurant_id, v_current) then
    raise exception 'forbidden';
  end if;
  if v_current = 'owner' and p_role <> 'owner'
     and (select count(*) from public.restaurant_members
          where restaurant_id = p_restaurant_id and role = 'owner') <= 1 then
    raise exception 'last_owner';
  end if;
  update public.restaurant_members set role = p_role
  where restaurant_id = p_restaurant_id and user_id = p_user_id;
end;
$$;

create function public.remove_member(p_restaurant_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  select role into v_current from public.restaurant_members
  where restaurant_id = p_restaurant_id and user_id = p_user_id;
  if not found then
    raise exception 'forbidden';
  end if;
  -- Cualquiera puede salirse del equipo; para quitar a otra persona hay que poder administrar su rol
  if p_user_id <> (select auth.uid()) and not private.can_assign_role(p_restaurant_id, v_current) then
    raise exception 'forbidden';
  end if;
  if v_current = 'owner'
     and (select count(*) from public.restaurant_members
          where restaurant_id = p_restaurant_id and role = 'owner') <= 1 then
    raise exception 'last_owner';
  end if;
  delete from public.restaurant_members where restaurant_id = p_restaurant_id and user_id = p_user_id;
end;
$$;

-- Acepta las invitaciones hechas al correo de quien llama. Exige correo CONFIRMADO:
-- así nadie puede entrar a un restaurante registrándose con un correo ajeno.
create function public.accept_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_count integer := 0;
  v_inv public.staff_invites;
begin
  if v_user is null then
    return 0;
  end if;
  select lower(email) into v_email from auth.users
  where id = v_user and email is not null and email_confirmed_at is not null and not is_anonymous;
  if v_email is null then
    return 0;
  end if;

  for v_inv in select * from public.staff_invites where email = v_email and accepted_at is null loop
    insert into public.restaurant_members (restaurant_id, user_id, role)
    values (v_inv.restaurant_id, v_user, v_inv.role)
    on conflict (restaurant_id, user_id) do nothing;
    update public.staff_invites set accepted_at = now() where id = v_inv.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.list_team(uuid), public.invite_member(uuid, text, text),
  public.revoke_invite(uuid), public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.accept_invites() from public, anon;
grant execute on function public.list_team(uuid), public.invite_member(uuid, text, text),
  public.revoke_invite(uuid), public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.accept_invites() to authenticated;
