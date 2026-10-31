-- ===== Cambios a un plato que cocina ya empezó: el comensal los pide y el mesero decide =====
create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.order_items(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  -- Mismos campos que update_item: { quantity, option_ids, note }. quantity 0 pide cancelar el plato.
  changes jsonb not null,
  -- Resumen legible del cambio ("Sin salsa"), para mostrarlo al mesero tal cual.
  message text not null check (char_length(message) between 1 and 300),
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create unique index change_requests_one_pending on public.change_requests (item_id) where status = 'pending';
create index change_requests_session_idx on public.change_requests (session_id);
create index change_requests_restaurant_pending_idx on public.change_requests (restaurant_id, created_at) where status = 'pending';
create index change_requests_requested_by_idx on public.change_requests (requested_by);
create index change_requests_resolved_by_idx on public.change_requests (resolved_by);

alter table public.change_requests enable row level security;
revoke all on public.change_requests from anon;
revoke insert, update, delete, truncate, references, trigger on public.change_requests from authenticated;
create policy change_requests_select on public.change_requests
  for select to authenticated
  using (private.is_member(restaurant_id) or private.is_participant(session_id));

-- Aplica cambios a un plato sin comprobar quién lo pide (quien llama ya validó permisos).
create function private.apply_item_changes(p_item_id uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.order_items;
  v_priced jsonb;
  v_qty integer;
begin
  select * into v_item from public.order_items where id = p_item_id for update;
  if not found then
    raise exception 'invalid_item';
  end if;
  if v_item.status not in ('pending', 'preparing') then
    raise exception 'not_editable';
  end if;

  if p_changes ? 'quantity' then
    v_qty := (p_changes ->> 'quantity')::integer;
    if v_qty <= 0 then
      update public.order_items
      set status = 'cancelled', changed_after_start = changed_after_start or v_item.status = 'preparing'
      where id = p_item_id;
      return;
    end if;
    v_item.quantity := least(v_qty, 20);
  end if;

  if p_changes ? 'option_ids' then
    if v_item.dish_id is null then
      raise exception 'dish_unavailable';
    end if;
    v_priced := private.price_options(
      v_item.dish_id,
      array(select jsonb_array_elements_text(p_changes -> 'option_ids')::uuid));
    v_item.options := v_priced -> 'options';
    v_item.unit_price_cents := v_item.base_price_cents + (v_priced ->> 'delta')::integer;
  end if;

  if p_changes ? 'note' then
    v_item.note := left(nullif(btrim(p_changes ->> 'note'), ''), 200);
  end if;

  update public.order_items
  set quantity = v_item.quantity,
      options = v_item.options,
      unit_price_cents = v_item.unit_price_cents,
      note = v_item.note,
      changed_after_start = changed_after_start or v_item.status = 'preparing'
  where id = p_item_id;
end;
$$;
revoke execute on function private.apply_item_changes(uuid, jsonb) from public, anon, authenticated;

-- Comensal: pide un cambio sobre un plato que ya está en preparación.
create function public.request_item_change(p_item_id uuid, p_changes jsonb, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item public.order_items;
  v_rest public.restaurants;
  v_session public.table_sessions;
  v_part public.session_participants;
  v_message text := left(nullif(btrim(p_message), ''), 300);
  v_id uuid;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;
  if v_message is null or jsonb_typeof(p_changes) is distinct from 'object' then
    raise exception 'invalid_items';
  end if;

  select * into v_item from public.order_items where id = p_item_id;
  if not found then
    raise exception 'invalid_item';
  end if;
  select * into v_session from public.table_sessions where id = v_item.session_id;
  select * into v_rest from public.restaurants where id = v_item.restaurant_id;
  if v_session.status <> 'open' then
    raise exception 'session_closed';
  end if;
  if v_rest.ordering_mode = 'staff' then
    raise exception 'diner_ordering_disabled';
  end if;

  select * into v_part from public.session_participants
  where session_id = v_item.session_id and user_id = v_user;
  if v_part.user_id is null
     or not (v_item.added_by = v_user or (v_item.seat_id is not null and v_item.seat_id = v_part.seat_id)) then
    raise exception 'forbidden';
  end if;

  -- Solo tiene sentido pedirlo cuando ya no se puede cambiar directamente.
  if v_item.status = 'pending' or (v_item.status = 'preparing' and v_rest.change_policy = 'until_ready') then
    raise exception 'edit_directly';
  end if;
  if v_item.status <> 'preparing' then
    raise exception 'not_editable';
  end if;
  if exists (select 1 from public.change_requests where item_id = p_item_id and status = 'pending') then
    raise exception 'request_pending';
  end if;

  -- Se valida ya (opciones y cantidad) para no hacer perder tiempo al mesero con algo inválido.
  if p_changes ? 'option_ids' then
    perform private.price_options(
      v_item.dish_id,
      array(select jsonb_array_elements_text(p_changes -> 'option_ids')::uuid));
  end if;

  insert into public.change_requests (item_id, session_id, restaurant_id, changes, message, requested_by)
  values (
    p_item_id, v_item.session_id, v_item.restaurant_id,
    jsonb_strip_nulls(jsonb_build_object(
      'quantity', p_changes -> 'quantity', 'option_ids', p_changes -> 'option_ids', 'note', p_changes -> 'note')),
    v_message, v_user)
  returning id into v_id;
  return v_id;
end;
$$;

-- Personal que toma pedidos: acepta (aplica el cambio) o rechaza la solicitud.
create function public.resolve_item_change(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_req public.change_requests;
begin
  select * into v_req from public.change_requests where id = p_request_id and status = 'pending' for update;
  if not found then
    return;
  end if;
  if not private.has_permission(v_req.restaurant_id, 'orders.take') then
    raise exception 'forbidden';
  end if;
  if p_accept then
    perform private.apply_item_changes(v_req.item_id, v_req.changes);
  end if;
  update public.change_requests
  set status = case when p_accept then 'approved' else 'rejected' end,
      resolved_at = now(), resolved_by = v_user
  where id = p_request_id;
end;
$$;

revoke execute on function public.request_item_change(uuid, jsonb, text), public.resolve_item_change(uuid, boolean) from public, anon;
grant execute on function public.request_item_change(uuid, jsonb, text), public.resolve_item_change(uuid, boolean) to authenticated;

alter publication supabase_realtime add table public.change_requests;

-- Quien toma pedidos puede editar un plato aunque ya esté en preparación (se marca para cocina).
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.update_item(uuid, jsonb)'::regprocedure) into v_def;
  if position('v_item.status = ''preparing'' and v_rest.change_policy = ''until_ready''' in v_def) = 0 then
    raise exception 'patrón no encontrado en update_item';
  end if;
  execute replace(v_def,
    'v_item.status = ''preparing'' and v_rest.change_policy = ''until_ready''',
    'v_item.status = ''preparing'' and (v_is_staff or v_rest.change_policy = ''until_ready'')');
end $$;

-- Al cerrar la mesa también se descartan las solicitudes de cambio pendientes.
create or replace function private.resolve_requests_on_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.service_requests set resolved_at = now()
  where session_id = new.id and resolved_at is null;
  update public.change_requests set status = 'rejected', resolved_at = now()
  where session_id = new.id and status = 'pending';
  return new;
end;
$$;
