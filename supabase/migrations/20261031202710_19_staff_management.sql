-- ===== Personal: enlaces para unirse, mesas atendidas, suspensión, bajas seguras, auditoría y rendimiento =====

alter table public.restaurant_members
  add column display_name text check (display_name is null or char_length(display_name) <= 60),
  -- Suspender deja la cuenta pero sin acceso al restaurante (más seguro que eliminar).
  add column active boolean not null default true;

-- Quién atiende cada mesa abierta.
alter table public.table_sessions
  add column waiter_id uuid references auth.users(id) on delete set null;
create index table_sessions_waiter_idx on public.table_sessions (waiter_id);

-- Un miembro suspendido deja de contar en todas las comprobaciones de acceso.
create or replace function private.is_member(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id and m.user_id = (select auth.uid()) and m.active
  );
$$;

create or replace function private.is_owner(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id and m.user_id = (select auth.uid())
      and m.role = 'owner' and m.active
  );
$$;

create or replace function private.has_permission(p_restaurant_id uuid, p_permission text)
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
      and m.active
      and case p_permission
        when 'menu.edit'       then m.role in ('owner', 'manager')
        when 'tables.edit'     then m.role in ('owner', 'manager', 'host')
        when 'settings.edit'   then m.role in ('owner', 'manager')
        when 'team.manage'     then m.role in ('owner', 'manager')
        when 'orders.take'     then m.role in ('owner', 'manager', 'host', 'waiter')
        when 'orders.kitchen'  then m.role in ('owner', 'manager', 'kitchen', 'waiter')
        when 'orders.serve'    then m.role in ('owner', 'manager', 'host', 'waiter')
        when 'orders.cancel'   then m.role in ('owner', 'manager', 'waiter', 'kitchen')
        when 'session.close'   then m.role in ('owner', 'manager', 'cashier')
                                    or (m.role in ('host', 'waiter') and exists (
                                          select 1 from public.restaurants r
                                          where r.id = p_restaurant_id and r.table_close = 'staff'))
        when 'payments.manage' then m.role in ('owner', 'manager', 'host', 'waiter', 'cashier')
        when 'orders.view'     then true
        else false
      end
  );
$$;

create or replace function private.can_assign_role(p_restaurant_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id and m.user_id = (select auth.uid()) and m.active
      and (m.role = 'owner'
           or (m.role = 'manager' and p_role in ('host', 'waiter', 'kitchen', 'cashier')))
  );
$$;

-- Registro de lo que pasa con el equipo (quién entró, quién cambió un rol, quién fue dado de baja…).
create table public.staff_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor uuid references auth.users(id) on delete set null,
  target uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index staff_events_restaurant_idx on public.staff_events (restaurant_id, created_at desc);
create index staff_events_actor_idx on public.staff_events (actor);
create index staff_events_target_idx on public.staff_events (target);
alter table public.staff_events enable row level security;
revoke all on public.staff_events from anon;
revoke insert, update, delete, truncate, references, trigger on public.staff_events from authenticated;
create policy staff_events_select on public.staff_events
  for select to authenticated using (private.has_permission(restaurant_id, 'team.manage'));

create function private.log_staff_event(p_restaurant_id uuid, p_target uuid, p_action text, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.staff_events (restaurant_id, actor, target, action, detail)
  values (p_restaurant_id, (select auth.uid()), p_target, p_action, p_detail);
$$;
revoke execute on function private.log_staff_event(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- Enlaces (y códigos) para que alguien se una al equipo: caducan, tienen usos limitados y se pueden revocar.
create table public.staff_join_links (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code text not null unique,
  role text not null check (role in ('manager', 'host', 'waiter', 'kitchen', 'cashier')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 50),
  uses integer not null default 0,
  active boolean not null default true
);
create index staff_join_links_restaurant_idx on public.staff_join_links (restaurant_id, created_at desc);
create index staff_join_links_created_by_idx on public.staff_join_links (created_by);
alter table public.staff_join_links enable row level security;
revoke all on public.staff_join_links from anon;
revoke insert, update, delete, truncate, references, trigger on public.staff_join_links from authenticated;
create policy staff_join_links_select on public.staff_join_links
  for select to authenticated using (private.has_permission(restaurant_id, 'team.manage'));

-- Dueño o gerente crea un enlace para un rol (el gerente no puede crear enlaces de gerente; nadie, de dueño).
create function public.create_staff_link(p_restaurant_id uuid, p_role text, p_days integer default 7, p_max_uses integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := private.new_code(10);
  v_expires timestamptz := now() + make_interval(days => greatest(1, least(p_days, 30)));
begin
  if p_role not in ('manager', 'host', 'waiter', 'kitchen', 'cashier') or not private.can_assign_role(p_restaurant_id, p_role) then
    raise exception 'forbidden';
  end if;
  insert into public.staff_join_links (restaurant_id, code, role, created_by, expires_at, max_uses)
  values (p_restaurant_id, v_code, p_role, (select auth.uid()), v_expires, greatest(1, least(p_max_uses, 50)));
  perform private.log_staff_event(p_restaurant_id, null, 'link_created', jsonb_build_object('role', p_role, 'max_uses', p_max_uses));
  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end;
$$;

create function public.revoke_staff_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.staff_join_links;
begin
  select * into v_link from public.staff_join_links where id = p_link_id;
  if not found or not private.can_assign_role(v_link.restaurant_id, v_link.role) then
    raise exception 'forbidden';
  end if;
  update public.staff_join_links set active = false where id = p_link_id;
  perform private.log_staff_event(v_link.restaurant_id, null, 'link_revoked', jsonb_build_object('role', v_link.role));
end;
$$;

-- Quien tiene un enlace ve a qué restaurante y con qué rol se uniría, antes de entrar (no revela nada de un código inválido).
create function public.preview_staff_link(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('restaurant', r.name, 'role', l.role)
  from public.staff_join_links l
  join public.restaurants r on r.id = l.restaurant_id
  where l.code = upper(btrim(p_code)) and l.active and l.expires_at > now() and l.uses < l.max_uses;
$$;

-- Canjea un enlace: exige cuenta con correo CONFIRMADO (nadie entra de invitado al equipo).
create function public.redeem_staff_link(p_code text, p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_link public.staff_join_links;
  v_rest public.restaurants;
begin
  if v_user is null or not exists (
    select 1 from auth.users where id = v_user and email is not null and email_confirmed_at is not null and not is_anonymous) then
    raise exception 'auth_required';
  end if;
  select * into v_link from public.staff_join_links
  where code = upper(btrim(p_code)) and active and expires_at > now() and uses < max_uses for update;
  if not found then
    raise exception 'invalid_link';
  end if;
  if exists (select 1 from public.restaurant_members where restaurant_id = v_link.restaurant_id and user_id = v_user) then
    raise exception 'already_member';
  end if;
  insert into public.restaurant_members (restaurant_id, user_id, role, display_name)
  values (v_link.restaurant_id, v_user, v_link.role, left(nullif(btrim(p_display_name), ''), 60));
  update public.staff_join_links
  set uses = uses + 1, active = (uses + 1) < max_uses
  where id = v_link.id;
  perform private.log_staff_event(v_link.restaurant_id, v_user, 'joined_by_link', jsonb_build_object('role', v_link.role));
  select * into v_rest from public.restaurants where id = v_link.restaurant_id;
  return jsonb_build_object('restaurant', v_rest.name, 'role', v_link.role);
end;
$$;

-- Cada miembro puede poner su propio nombre.
create function public.set_my_name(p_restaurant_id uuid, p_name text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.restaurant_members set display_name = left(nullif(btrim(p_name), ''), 60)
  where restaurant_id = p_restaurant_id and user_id = (select auth.uid());
$$;

-- Nombres del equipo para mostrar quién atiende cada mesa (sin correos).
create function public.list_staff_names(p_restaurant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_restaurant_id) then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', m.display_name, 'role', m.role) order by m.created_at)
    from public.restaurant_members m where m.restaurant_id = p_restaurant_id and m.active), '[]'::jsonb);
end;
$$;

-- Equipo para dueño/gerente: nombres, correos, estado, mesas abiertas que atienden e invitaciones pendientes.
create or replace function public.list_team(p_restaurant_id uuid)
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
        'user_id', m.user_id, 'email', u.email, 'role', m.role, 'created_at', m.created_at,
        'display_name', m.display_name, 'active', m.active,
        'open_tables', (select count(*) from public.table_sessions s
                        where s.restaurant_id = p_restaurant_id and s.waiter_id = m.user_id and s.status = 'open'))
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

-- Cambiar de rol queda registrado.
create or replace function public.set_member_role(p_restaurant_id uuid, p_user_id uuid, p_role text)
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
  if not found
     or not private.can_assign_role(p_restaurant_id, p_role)
     or not private.can_assign_role(p_restaurant_id, v_current) then
    raise exception 'forbidden';
  end if;
  if v_current = 'owner' and p_role <> 'owner'
     and (select count(*) from public.restaurant_members
          where restaurant_id = p_restaurant_id and role = 'owner' and active) <= 1 then
    raise exception 'last_owner';
  end if;
  update public.restaurant_members set role = p_role
  where restaurant_id = p_restaurant_id and user_id = p_user_id;
  perform private.log_staff_event(p_restaurant_id, p_user_id, 'role_changed', jsonb_build_object('from', v_current, 'to', p_role));
end;
$$;

-- Suspender o reactivar: la persona conserva su cuenta pero pierde (o recupera) el acceso.
create function public.set_member_active(p_restaurant_id uuid, p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select role into v_role from public.restaurant_members where restaurant_id = p_restaurant_id and user_id = p_user_id;
  if not found
     or p_user_id = (select auth.uid())
     or not private.can_assign_role(p_restaurant_id, v_role) then
    raise exception 'forbidden';
  end if;
  if v_role = 'owner' and not p_active
     and (select count(*) from public.restaurant_members
          where restaurant_id = p_restaurant_id and role = 'owner' and active) <= 1 then
    raise exception 'last_owner';
  end if;
  update public.restaurant_members set active = p_active
  where restaurant_id = p_restaurant_id and user_id = p_user_id;
  -- Las mesas que atendía quedan sin responsable hasta que otro las tome.
  if not p_active then
    update public.table_sessions set waiter_id = null
    where restaurant_id = p_restaurant_id and waiter_id = p_user_id and status = 'open';
  end if;
  perform private.log_staff_event(p_restaurant_id, p_user_id, case when p_active then 'reactivated' else 'suspended' end);
end;
$$;

-- Dar de baja exige escribir el nombre o el correo de la persona (evita errores); queda registrado.
drop function public.remove_member(uuid, uuid);
create function public.remove_member(p_restaurant_id uuid, p_user_id uuid, p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_name text;
  v_email text;
begin
  select m.role, m.display_name, u.email into v_role, v_name, v_email
  from public.restaurant_members m join auth.users u on u.id = m.user_id
  where m.restaurant_id = p_restaurant_id and m.user_id = p_user_id;
  if not found then
    raise exception 'forbidden';
  end if;
  -- Cualquiera puede salirse del equipo; para dar de baja a otra persona hay que poder administrar su rol.
  if p_user_id <> (select auth.uid()) and not private.can_assign_role(p_restaurant_id, v_role) then
    raise exception 'forbidden';
  end if;
  if lower(btrim(coalesce(p_confirm, ''))) not in (lower(coalesce(v_name, '')), lower(coalesce(v_email, ''))) or btrim(coalesce(p_confirm, '')) = '' then
    raise exception 'confirmation_mismatch';
  end if;
  if v_role = 'owner'
     and (select count(*) from public.restaurant_members
          where restaurant_id = p_restaurant_id and role = 'owner' and active) <= 1 then
    raise exception 'last_owner';
  end if;
  update public.table_sessions set waiter_id = null
  where restaurant_id = p_restaurant_id and waiter_id = p_user_id and status = 'open';
  delete from public.restaurant_members where restaurant_id = p_restaurant_id and user_id = p_user_id;
  perform private.log_staff_event(p_restaurant_id, p_user_id, 'removed', jsonb_build_object('role', v_role, 'email', v_email));
end;
$$;

-- Quién atiende la mesa: quien la abre desde el Salón, quien la toma, o a quien la asigna un gerente.
create or replace function public.staff_open_session(p_table_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.dining_tables;
  v_session public.table_sessions;
begin
  select * into v_table from public.dining_tables where id = p_table_id and active;
  if not found or not private.has_permission(v_table.restaurant_id, 'orders.take') then
    raise exception 'forbidden';
  end if;
  v_session := private.open_session(v_table);
  update public.table_sessions set waiter_id = coalesce(waiter_id, (select auth.uid())) where id = v_session.id;
  return v_session.id;
end;
$$;

create function public.claim_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
begin
  select * into v_session from public.table_sessions where id = p_session_id and status = 'open';
  if not found or not private.has_permission(v_session.restaurant_id, 'orders.take') then
    raise exception 'forbidden';
  end if;
  update public.table_sessions set waiter_id = (select auth.uid()) where id = p_session_id;
end;
$$;

create function public.assign_session(p_session_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
begin
  select * into v_session from public.table_sessions where id = p_session_id and status = 'open';
  if not found or not private.has_permission(v_session.restaurant_id, 'team.manage') then
    raise exception 'forbidden';
  end if;
  if p_user_id is not null and not exists (
    select 1 from public.restaurant_members
    where restaurant_id = v_session.restaurant_id and user_id = p_user_id and active
      and role in ('owner', 'manager', 'host', 'waiter')) then
    raise exception 'invalid_member';
  end if;
  update public.table_sessions set waiter_id = p_user_id where id = p_session_id;
  perform private.log_staff_event(v_session.restaurant_id, p_user_id, 'table_assigned', jsonb_build_object('table', v_session.table_label));
end;
$$;

-- Rendimiento por persona en un periodo (solo dueño y gerente).
create function public.staff_performance(p_restaurant_id uuid, p_from timestamptz, p_to timestamptz)
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
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'role', m.role, 'display_name', m.display_name, 'email', u.email, 'active', m.active,
      -- Mesas que atendió (abiertas en el periodo).
      'tables', (select count(*) from public.table_sessions s
                 where s.restaurant_id = p_restaurant_id and s.waiter_id = m.user_id and s.opened_at >= p_from and s.opened_at < p_to),
      -- Platos que tomó él mismo (como personal).
      'items_taken', (select count(*) from public.order_items i
                      where i.restaurant_id = p_restaurant_id and i.added_by = m.user_id and i.added_by_staff
                        and i.created_at >= p_from and i.created_at < p_to and i.status <> 'cancelled'),
      -- Ventas de las mesas que atendió (pagos confirmados).
      'sales_cents', (select coalesce(sum(p.amount_usd_cents), 0) from public.payments p
                      join public.table_sessions s on s.id = p.session_id
                      where p.restaurant_id = p_restaurant_id and p.status = 'confirmed' and s.waiter_id = m.user_id
                        and p.created_at >= p_from and p.created_at < p_to),
      -- Lo que cobró o confirmó personalmente.
      'collected_cents', (select coalesce(sum(p.amount_usd_cents), 0) from public.payments p
                          where p.restaurant_id = p_restaurant_id and p.status = 'confirmed' and p.resolved_by = m.user_id
                            and p.created_at >= p_from and p.created_at < p_to),
      'collected_count', (select count(*) from public.payments p
                          where p.restaurant_id = p_restaurant_id and p.status = 'confirmed' and p.resolved_by = m.user_id
                            and p.created_at >= p_from and p.created_at < p_to),
      -- Minutos promedio que duran sus mesas (cerradas en el periodo).
      'avg_minutes', (select round(avg(extract(epoch from (s.closed_at - s.opened_at)) / 60)::numeric, 0)
                      from public.table_sessions s
                      where s.restaurant_id = p_restaurant_id and s.waiter_id = m.user_id and s.status = 'closed'
                        and s.closed_at >= p_from and s.closed_at < p_to),
      'open_tables', (select count(*) from public.table_sessions s
                      where s.restaurant_id = p_restaurant_id and s.waiter_id = m.user_id and s.status = 'open')
    ) order by m.created_at)
    from public.restaurant_members m join auth.users u on u.id = m.user_id
    where m.restaurant_id = p_restaurant_id), '[]'::jsonb);
end;
$$;

revoke execute on function public.create_staff_link(uuid, text, integer, integer), public.revoke_staff_link(uuid),
  public.redeem_staff_link(text, text), public.set_my_name(uuid, text), public.list_staff_names(uuid),
  public.set_member_active(uuid, uuid, boolean), public.remove_member(uuid, uuid, text),
  public.claim_session(uuid), public.assign_session(uuid, uuid), public.staff_performance(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.create_staff_link(uuid, text, integer, integer), public.revoke_staff_link(uuid),
  public.redeem_staff_link(text, text), public.set_my_name(uuid, text), public.list_staff_names(uuid),
  public.set_member_active(uuid, uuid, boolean), public.remove_member(uuid, uuid, text),
  public.claim_session(uuid), public.assign_session(uuid, uuid), public.staff_performance(uuid, timestamptz, timestamptz)
  to authenticated;
revoke execute on function public.preview_staff_link(text) from public;
grant execute on function public.preview_staff_link(text) to anon, authenticated;
