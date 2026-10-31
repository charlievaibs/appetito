-- ===== Que una foto del QR no baste para sentarse =====
-- El QR/NFC fijo solo IDENTIFICA la mesa. Con la mesa ocupada ya no autoriza: se entra con una
-- invitación rotativa (QR que caduca en minutos), un código o la aprobación del mesero.

-- casual: el QR fijo abre una mesa libre (queda "por confirmar" hasta que el mesero lo confirma).
-- strict: solo el mesero abre las mesas; el QR fijo pide permiso.
alter table public.restaurants
  add column table_security text not null default 'casual' check (table_security in ('casual', 'strict'));

-- Una mesa abierta con un escaneo sin personal queda sin confirmar y no llega a cocina.
alter table public.table_sessions add column confirmed boolean not null default true;

-- Invitaciones rotativas: el token vive pocos minutos; solo se crean y consumen por funciones.
create table public.session_invites (
  token text primary key,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null
);
create index session_invites_session_idx on public.session_invites (session_id);
create index session_invites_created_by_idx on public.session_invites (created_by);
alter table public.session_invites enable row level security;
revoke all on public.session_invites from anon, authenticated;

-- open_session ahora puede abrir la mesa sin confirmar; la versión de siempre confirma.
create function private.open_session_with(p_table public.dining_tables, p_confirmed boolean)
returns public.table_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
begin
  select * into v_session from public.table_sessions where table_id = p_table.id and status = 'open';
  if found then
    return v_session;
  end if;
  insert into public.table_sessions (restaurant_id, table_id, table_label, confirmed)
  values (p_table.restaurant_id, p_table.id, p_table.label, p_confirmed)
  on conflict (table_id) where status = 'open' do nothing
  returning * into v_session;
  if not found then
    select * into v_session from public.table_sessions where table_id = p_table.id and status = 'open';
  end if;
  return v_session;
end;
$$;
revoke execute on function private.open_session_with(public.dining_tables, boolean) from public, anon, authenticated;

create or replace function private.open_session(p_table public.dining_tables)
returns public.table_sessions
language sql
security definer
set search_path = ''
as $$
  select * from private.open_session_with(p_table, true);
$$;

-- join_table recibe si la mesa que abra debe quedar confirmada.
drop function private.join_table(uuid, public.dining_tables, uuid, text);
create function private.join_table(
  p_user uuid, p_table public.dining_tables, p_seat_id uuid, p_name text, p_confirmed boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rest public.restaurants;
  v_session public.table_sessions;
  v_name text := left(nullif(btrim(p_name), ''), 60);
begin
  select * into v_rest from public.restaurants where id = p_table.restaurant_id;
  v_session := private.open_session_with(p_table, p_confirmed);

  insert into public.session_participants (session_id, user_id, seat_id, display_name)
  values (v_session.id, p_user, p_seat_id, v_name)
  on conflict (session_id, user_id) do update
    set seat_id = coalesce(excluded.seat_id, public.session_participants.seat_id),
        display_name = coalesce(excluded.display_name, public.session_participants.display_name);

  return jsonb_build_object(
    'status', 'joined',
    'session_id', v_session.id,
    'restaurant', jsonb_build_object(
      'id', v_rest.id, 'name', v_rest.name, 'slug', v_rest.slug,
      'ordering_mode', v_rest.ordering_mode, 'identification', v_rest.identification,
      'change_policy', v_rest.change_policy),
    'table', jsonb_build_object('id', p_table.id, 'label', p_table.label, 'reserved_by', p_table.reserved_by),
    'participant', (
      select jsonb_build_object('seat_id', p.seat_id, 'seat_label', s.label, 'display_name', p.display_name)
      from public.session_participants p
      left join public.seats s on s.id = p.seat_id
      where p.session_id = v_session.id and p.user_id = p_user),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label) order by s.position, s.label)
      from public.seats s where s.table_id = p_table.id), '[]'::jsonb)
  );
end;
$$;
revoke execute on function private.join_table(uuid, public.dining_tables, uuid, text, boolean) from public, anon, authenticated;

-- Crea (o reutiliza) una solicitud de acceso pendiente y devuelve {status:'pending', request_id}.
create function private.request_access(p_user uuid, p_table public.dining_tables, p_seat_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.join_requests (restaurant_id, table_id, seat_id, user_id, display_name)
  values (p_table.restaurant_id, p_table.id, p_seat_id, p_user, left(nullif(btrim(p_name), ''), 60))
  on conflict (user_id, table_id) where status = 'pending'
  do update set seat_id = excluded.seat_id, display_name = excluded.display_name
  returning id into v_id;
  return jsonb_build_object('status', 'pending', 'request_id', v_id);
end;
$$;
revoke execute on function private.request_access(uuid, public.dining_tables, uuid, text) from public, anon, authenticated;

-- QR/NFC fijo: identifica la mesa pero ya no autoriza si hay alguien sentado.
create or replace function public.join_session(
  p_token text,
  p_seat_id uuid default null,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_seat public.seats;
  v_table public.dining_tables;
  v_rest public.restaurants;
  v_session public.table_sessions;
  v_seat_id uuid;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  select * into v_seat from public.seats where qr_token = p_token;
  if found then
    select * into v_table from public.dining_tables where id = v_seat.table_id;
  else
    select * into v_table from public.dining_tables where qr_token = p_token;
  end if;
  if not found or not v_table.active then
    raise exception 'invalid_tag';
  end if;
  select * into v_rest from public.restaurants where id = v_table.restaurant_id;

  v_seat_id := v_seat.id;
  if v_seat_id is null and p_seat_id is not null then
    perform 1 from public.seats where id = p_seat_id and table_id = v_table.id;
    if not found then
      raise exception 'invalid_seat';
    end if;
    v_seat_id := p_seat_id;
  end if;

  select * into v_session from public.table_sessions where table_id = v_table.id and status = 'open';

  -- Quien ya está sentado vuelve a entrar sin trámites.
  if v_session.id is not null and exists (
    select 1 from public.session_participants where session_id = v_session.id and user_id = v_user) then
    return private.join_table(v_user, v_table, v_seat_id, p_display_name);
  end if;

  -- Mesa ocupada, reservada o de un restaurante estricto: una foto del QR no basta, decide el mesero.
  if v_session.id is not null or v_table.reservation_code is not null or v_rest.table_security = 'strict' then
    return private.request_access(v_user, v_table, v_seat_id, p_display_name);
  end if;

  -- Mesa libre en modo informal: se abre, pero queda por confirmar hasta que el personal la valide.
  return private.join_table(v_user, v_table, v_seat_id, p_display_name, false);
end;
$$;

-- join_table_manual: abrir una mesa libre sin personal solo en modo informal, y queda por confirmar.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.join_table_manual(uuid, uuid, text, text)'::regprocedure) into v_def;
  if position('and v_rest.manual_join = ''open'' then' in v_def) = 0 then
    raise exception 'patrón no encontrado en join_table_manual';
  end if;
  v_def := replace(v_def, 'and v_rest.manual_join = ''open'' then', 'and v_rest.manual_join = ''open'' and v_rest.table_security = ''casual'' then');
  -- La mesa abierta sin personal se abre sin confirmar (el único caso: libre + modo abierto + informal).
  v_def := replace(v_def,
    'return jsonb_build_object(''status'', ''joined'') || private.join_table(v_user, v_table, p_seat_id, v_name);
  end if;

  -- En cualquier otro caso',
    'return private.join_table(v_user, v_table, p_seat_id, v_name, false);
  end if;

  -- En cualquier otro caso');
  execute v_def;
end $$;

-- Invitación rotativa: la crea quien está sentado en la mesa o el personal que toma pedidos.
create function public.create_session_invite(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.table_sessions;
  v_token text := encode(extensions.gen_random_bytes(12), 'hex');
  v_expires timestamptz := now() + interval '150 seconds';
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;
  select * into v_session from public.table_sessions where id = p_session_id and status = 'open';
  if not found then
    raise exception 'invalid_session';
  end if;
  if not (private.is_participant(p_session_id) or private.has_permission(v_session.restaurant_id, 'orders.take')) then
    raise exception 'forbidden';
  end if;
  delete from public.session_invites where session_id = p_session_id and expires_at < now();
  insert into public.session_invites (token, session_id, created_by, expires_at)
  values (v_token, p_session_id, v_user, v_expires);
  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$$;

-- Entra a la mesa con una invitación vigente.
create function public.join_with_invite(p_token text, p_seat_id uuid default null, p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.session_invites;
  v_session public.table_sessions;
  v_table public.dining_tables;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;
  select * into v_invite from public.session_invites where token = p_token and expires_at > now();
  if not found then
    raise exception 'invalid_invite';
  end if;
  select * into v_session from public.table_sessions where id = v_invite.session_id and status = 'open';
  if not found then
    raise exception 'invalid_invite';
  end if;
  select * into v_table from public.dining_tables where id = v_session.table_id and active;
  if not found then
    raise exception 'invalid_invite';
  end if;
  if p_seat_id is not null then
    perform 1 from public.seats where id = p_seat_id and table_id = v_table.id;
    if not found then
      raise exception 'invalid_seat';
    end if;
  end if;
  return private.join_table(v_user, v_table, p_seat_id, p_display_name);
end;
$$;

-- El personal confirma que hay gente en una mesa abierta por escaneo.
create function public.confirm_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.table_sessions set confirmed = true
  where id = p_session_id and status = 'open' and private.has_permission(restaurant_id, 'orders.take');
  if not found then
    raise exception 'forbidden';
  end if;
end;
$$;

revoke execute on function public.create_session_invite(uuid), public.join_with_invite(text, uuid, text), public.confirm_session(uuid) from public, anon;
grant execute on function public.create_session_invite(uuid), public.join_with_invite(text, uuid, text), public.confirm_session(uuid) to authenticated;
