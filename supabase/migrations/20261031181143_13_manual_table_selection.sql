-- ===== Elegir mesa y asiento a mano (sin QR ni NFC) =====
-- Modo por restaurante: off = solo QR/NFC; approval = el mesero da acceso; open = mesas libres entran directo.
alter table public.restaurants
  add column manual_join text not null default 'approval' check (manual_join in ('off', 'approval', 'open'));
update public.restaurants set manual_join = 'open' where slug = 'demo';

-- Código de reserva: lo da quien reservó (o el mesero) para sentarse en una mesa reservada.
alter table public.dining_tables
  add column reservation_code text check (reservation_code is null or char_length(reservation_code) between 4 and 12);

-- Código corto sin caracteres confusos (sin 0/O ni 1/I/L), para dictarlo en voz alta.
create function private.new_code(p_length integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_result text := '';
begin
  for i in 1..p_length loop
    v_result := v_result || substr(v_alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 31), 1);
  end loop;
  return v_result;
end;
$$;
revoke execute on function private.new_code(integer) from public, anon, authenticated;

-- Cada mesa ocupada tiene un código para que sus acompañantes se unan sin esperar al mesero.
alter table public.table_sessions add column join_code text not null default private.new_code(6);

-- Solicitudes de acceso: alguien elige una mesa a mano y el mesero decide.
create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.dining_tables(id) on delete cascade,
  seat_id uuid references public.seats(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  session_id uuid references public.table_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create unique index join_requests_one_pending on public.join_requests (user_id, table_id) where status = 'pending';
create index join_requests_restaurant_pending_idx on public.join_requests (restaurant_id, created_at) where status = 'pending';
create index join_requests_table_idx on public.join_requests (table_id);
create index join_requests_seat_idx on public.join_requests (seat_id);
create index join_requests_session_idx on public.join_requests (session_id);
create index join_requests_resolved_by_idx on public.join_requests (resolved_by);

alter table public.join_requests enable row level security;
revoke all on public.join_requests from anon;
revoke insert, update, delete, truncate, references, trigger on public.join_requests from authenticated;
create policy join_requests_select on public.join_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member(restaurant_id));
alter publication supabase_realtime add table public.join_requests;

-- Sienta a una persona en una mesa (abre la sesión si hace falta) y devuelve el contexto de la mesa.
create function private.join_table(p_user uuid, p_table public.dining_tables, p_seat_id uuid, p_name text)
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
  v_session := private.open_session(p_table);

  insert into public.session_participants (session_id, user_id, seat_id, display_name)
  values (v_session.id, p_user, p_seat_id, v_name)
  on conflict (session_id, user_id) do update
    set seat_id = coalesce(excluded.seat_id, public.session_participants.seat_id),
        display_name = coalesce(excluded.display_name, public.session_participants.display_name);

  return jsonb_build_object(
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
revoke execute on function private.join_table(uuid, public.dining_tables, uuid, text) from public, anon, authenticated;

-- Público: mesas del restaurante con su estado (libre / ocupada / reservada) y asientos ocupados.
create function public.list_tables_for_join(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rest public.restaurants;
begin
  select * into v_rest from public.restaurants where slug = lower(btrim(p_slug));
  if not found or v_rest.manual_join = 'off' then
    return null;
  end if;
  return jsonb_build_object(
    'restaurant', jsonb_build_object('id', v_rest.id, 'name', v_rest.name, 'manual_join', v_rest.manual_join),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'label', t.label, 'capacity', t.capacity,
        'status', case
          when exists (select 1 from public.table_sessions s where s.table_id = t.id and s.status = 'open') then 'occupied'
          when t.reservation_code is not null then 'reserved'
          else 'free' end,
        'seats', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', se.id, 'label', se.label,
            'taken', exists (
              select 1 from public.session_participants p join public.table_sessions s on s.id = p.session_id
              where p.seat_id = se.id and s.status = 'open'))
            order by se.position, se.label)
          from public.seats se where se.table_id = t.id), '[]'::jsonb))
        order by t.label)
      from public.dining_tables t where t.restaurant_id = v_rest.id and t.active), '[]'::jsonb));
end;
$$;

-- Comensal: elige mesa (y asiento) a mano. Con código entra directo; sin código, según el modo del restaurante.
-- Devuelve {status:'joined', ...contexto} o {status:'pending', request_id}.
create function public.join_table_manual(
  p_table_id uuid,
  p_seat_id uuid default null,
  p_display_name text default null,
  p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_table public.dining_tables;
  v_rest public.restaurants;
  v_session public.table_sessions;
  v_code text := upper(nullif(btrim(p_code), ''));
  v_name text := left(nullif(btrim(p_display_name), ''), 60);
  v_request uuid;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;
  select * into v_table from public.dining_tables where id = p_table_id and active;
  if not found then
    raise exception 'invalid_tag';
  end if;
  select * into v_rest from public.restaurants where id = v_table.restaurant_id;
  if v_rest.manual_join = 'off' then
    raise exception 'manual_join_disabled';
  end if;
  if p_seat_id is not null then
    perform 1 from public.seats where id = p_seat_id and table_id = v_table.id;
    if not found then
      raise exception 'invalid_seat';
    end if;
  end if;

  select * into v_session from public.table_sessions where table_id = v_table.id and status = 'open';

  -- Un asiento ya ocupado por otra persona no se puede elegir.
  if p_seat_id is not null and v_session.id is not null and exists (
    select 1 from public.session_participants p
    where p.session_id = v_session.id and p.seat_id = p_seat_id and p.user_id <> v_user) then
    raise exception 'seat_taken';
  end if;

  -- Quien ya está sentado en esta mesa solo actualiza su asiento o nombre.
  if v_session.id is not null and exists (
    select 1 from public.session_participants where session_id = v_session.id and user_id = v_user) then
    return jsonb_build_object('status', 'joined') || private.join_table(v_user, v_table, p_seat_id, v_name);
  end if;

  if v_code is not null then
    if (v_session.id is not null and v_code = v_session.join_code)
       or (v_table.reservation_code is not null and v_code = upper(v_table.reservation_code)) then
      return jsonb_build_object('status', 'joined') || private.join_table(v_user, v_table, p_seat_id, v_name);
    end if;
    raise exception 'invalid_code';
  end if;

  -- Mesa libre y sin reserva en modo abierto: entra directo.
  if v_session.id is null and v_table.reservation_code is null and v_rest.manual_join = 'open' then
    return jsonb_build_object('status', 'joined') || private.join_table(v_user, v_table, p_seat_id, v_name);
  end if;

  -- En cualquier otro caso (ocupada, reservada o modo con aprobación) decide el mesero.
  insert into public.join_requests (restaurant_id, table_id, seat_id, user_id, display_name)
  values (v_rest.id, v_table.id, p_seat_id, v_user, v_name)
  on conflict (user_id, table_id) where status = 'pending'
  do update set seat_id = excluded.seat_id, display_name = excluded.display_name
  returning id into v_request;
  return jsonb_build_object('status', 'pending', 'request_id', v_request);
end;
$$;

-- Comensal: cancela su solicitud de acceso.
create function public.cancel_join_request(p_request_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.join_requests set status = 'cancelled', resolved_at = now()
  where id = p_request_id and user_id = (select auth.uid()) and status = 'pending';
$$;

-- Personal que toma pedidos: da acceso (sienta a la persona) o rechaza.
create function public.resolve_join_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.join_requests;
  v_table public.dining_tables;
  v_session public.table_sessions;
begin
  select * into v_req from public.join_requests where id = p_request_id and status = 'pending' for update;
  if not found then
    return;
  end if;
  if not private.has_permission(v_req.restaurant_id, 'orders.take') then
    raise exception 'forbidden';
  end if;
  if p_accept then
    select * into v_table from public.dining_tables where id = v_req.table_id and active;
    if not found then
      raise exception 'invalid_tag';
    end if;
    v_session := private.open_session(v_table);
    insert into public.session_participants (session_id, user_id, seat_id, display_name)
    values (v_session.id, v_req.user_id, v_req.seat_id, v_req.display_name)
    on conflict (session_id, user_id) do update
      set seat_id = coalesce(excluded.seat_id, public.session_participants.seat_id),
          display_name = coalesce(excluded.display_name, public.session_participants.display_name);
    update public.join_requests
    set status = 'approved', session_id = v_session.id, resolved_at = now(), resolved_by = (select auth.uid())
    where id = p_request_id;
  else
    update public.join_requests
    set status = 'rejected', resolved_at = now(), resolved_by = (select auth.uid())
    where id = p_request_id;
  end if;
end;
$$;

revoke execute on function public.list_tables_for_join(text) from public;
grant execute on function public.list_tables_for_join(text) to anon, authenticated;
revoke execute on function public.join_table_manual(uuid, uuid, text, text), public.cancel_join_request(uuid), public.resolve_join_request(uuid, boolean) from public, anon;
grant execute on function public.join_table_manual(uuid, uuid, text, text), public.cancel_join_request(uuid), public.resolve_join_request(uuid, boolean) to authenticated;
