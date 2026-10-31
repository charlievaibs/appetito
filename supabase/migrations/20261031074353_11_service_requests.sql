-- ===== Avisos de servicio: "llamar al mesero" y "pedir la cuenta" =====
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_label text not null,
  seat_label text,
  kind text not null check (kind in ('waiter', 'bill')),
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
-- Un solo aviso pendiente de cada tipo por mesa: tocar la etiqueta diez veces no llena el tablero.
create unique index service_requests_one_pending
  on public.service_requests (session_id, kind) where resolved_at is null;
create index service_requests_restaurant_pending_idx
  on public.service_requests (restaurant_id, created_at) where resolved_at is null;
create index service_requests_requested_by_idx on public.service_requests (requested_by);
create index service_requests_resolved_by_idx on public.service_requests (resolved_by);

alter table public.service_requests enable row level security;
revoke all on public.service_requests from anon;
revoke insert, update, delete, truncate, references, trigger on public.service_requests from authenticated;

-- Lo ve todo el equipo y los comensales sentados en esa mesa; solo se escribe por funciones.
create policy service_requests_select on public.service_requests
  for select to authenticated
  using (private.is_member(restaurant_id) or private.is_participant(session_id));

-- Comensal o personal: avisa que necesita al mesero o la cuenta (devuelve el aviso pendiente si ya existía).
create function public.request_service(p_session_id uuid, p_kind text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.table_sessions;
  v_seat_label text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;
  if p_kind not in ('waiter', 'bill') then
    raise exception 'invalid_kind';
  end if;

  select * into v_session from public.table_sessions where id = p_session_id and status = 'open';
  if not found then
    raise exception 'invalid_session';
  end if;
  if not (private.is_participant(p_session_id) or private.is_member(v_session.restaurant_id)) then
    raise exception 'forbidden';
  end if;

  select s.label into v_seat_label
  from public.session_participants p join public.seats s on s.id = p.seat_id
  where p.session_id = p_session_id and p.user_id = v_user;

  insert into public.service_requests (session_id, restaurant_id, table_label, seat_label, kind, requested_by)
  values (p_session_id, v_session.restaurant_id, v_session.table_label, v_seat_label, p_kind, v_user)
  on conflict (session_id, kind) where resolved_at is null do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.service_requests
    where session_id = p_session_id and kind = p_kind and resolved_at is null;
  end if;
  return v_id;
end;
$$;

-- Quien lo pidió puede cancelarlo; el equipo lo marca como atendido.
create function public.resolve_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_req public.service_requests;
begin
  select * into v_req from public.service_requests where id = p_request_id and resolved_at is null;
  if not found then
    return;
  end if;
  if not (private.is_member(v_req.restaurant_id) or v_req.requested_by = v_user) then
    raise exception 'forbidden';
  end if;
  update public.service_requests set resolved_at = now(), resolved_by = v_user where id = p_request_id;
end;
$$;

revoke execute on function public.request_service(uuid, text), public.resolve_request(uuid) from public, anon;
grant execute on function public.request_service(uuid, text), public.resolve_request(uuid) to authenticated;

alter publication supabase_realtime add table public.service_requests;

-- Cerrar la mesa deja resueltos los avisos que quedaran pendientes.
create function private.resolve_requests_on_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.service_requests set resolved_at = now()
  where session_id = new.id and resolved_at is null;
  return new;
end;
$$;
revoke execute on function private.resolve_requests_on_close() from public, anon, authenticated;
create trigger table_sessions_resolve_requests
after update of status on public.table_sessions
for each row when (new.status = 'closed' and old.status = 'open')
execute function private.resolve_requests_on_close();
