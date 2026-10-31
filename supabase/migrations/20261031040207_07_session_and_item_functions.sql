-- ===== Ayudante: valida las opciones elegidas de un plato y calcula el sobreprecio =====
-- Devuelve {delta, options}; lanza invalid_option u option_rules si algo no cuadra.
create function private.price_options(p_dish_id uuid, p_option_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_delta integer;
  v_opts jsonb;
  v_count integer;
begin
  v_ids := array(select distinct x from unnest(coalesce(p_option_ids, '{}'::uuid[])) x);

  select coalesce(sum(o.price_delta_cents), 0),
         coalesce(jsonb_agg(jsonb_build_object(
           'group', g.name, 'name', o.name, 'price_delta_cents', o.price_delta_cents
         ) order by g.position, o.position), '[]'::jsonb),
         count(*)
    into v_delta, v_opts, v_count
  from public.dish_options o
  join public.dish_option_groups g on g.id = o.group_id
  where o.id = any(v_ids) and g.dish_id = p_dish_id and o.available;

  -- Todas las opciones pedidas deben existir, ser de este plato y estar disponibles
  if v_count <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'invalid_option';
  end if;

  -- Grupos "single" admiten una sola opción; los "required" exigen al menos una
  if exists (
    select 1 from public.dish_option_groups g
    where g.dish_id = p_dish_id and (
      (g.kind = 'single' and (
        select count(*) from public.dish_options o where o.group_id = g.id and o.id = any(v_ids)) > 1)
      or (g.required and (
        select count(*) from public.dish_options o where o.group_id = g.id and o.id = any(v_ids)) = 0)
    )
  ) then
    raise exception 'option_rules';
  end if;

  return jsonb_build_object('delta', v_delta, 'options', v_opts);
end;
$$;
revoke execute on function private.price_options(uuid, uuid[]) from public, anon, authenticated;

-- ===== Ayudante: abre la sesión de una mesa o reutiliza la que ya está abierta =====
create function private.open_session(p_table public.dining_tables)
returns public.table_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
begin
  select * into v_session from public.table_sessions
  where table_id = p_table.id and status = 'open';
  if found then
    return v_session;
  end if;

  insert into public.table_sessions (restaurant_id, table_id, table_label)
  values (p_table.restaurant_id, p_table.id, p_table.label)
  on conflict (table_id) where status = 'open' do nothing
  returning * into v_session;

  -- Si dos personas escanean a la vez, la segunda inserción no hace nada: se lee la ya creada
  if not found then
    select * into v_session from public.table_sessions
    where table_id = p_table.id and status = 'open';
  end if;
  return v_session;
end;
$$;
revoke execute on function private.open_session(public.dining_tables) from public, anon, authenticated;

-- ===== Comensal: entra a una mesa con el código de un QR o una etiqueta NFC =====
create function public.join_session(
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
  v_name text := left(nullif(btrim(p_display_name), ''), 60);
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  -- El código puede ser de un puesto (fija mesa y puesto) o de una mesa
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

  -- Con código de mesa, el comensal puede indicar su puesto (opcional)
  v_seat_id := v_seat.id;
  if v_seat_id is null and p_seat_id is not null then
    perform 1 from public.seats where id = p_seat_id and table_id = v_table.id;
    if not found then
      raise exception 'invalid_seat';
    end if;
    v_seat_id := p_seat_id;
  end if;

  v_session := private.open_session(v_table);

  insert into public.session_participants (session_id, user_id, seat_id, display_name)
  values (v_session.id, v_user, v_seat_id, v_name)
  on conflict (session_id, user_id) do update
    set seat_id = coalesce(excluded.seat_id, public.session_participants.seat_id),
        display_name = coalesce(excluded.display_name, public.session_participants.display_name);

  return jsonb_build_object(
    'session_id', v_session.id,
    'restaurant', jsonb_build_object(
      'id', v_rest.id, 'name', v_rest.name, 'slug', v_rest.slug,
      'ordering_mode', v_rest.ordering_mode, 'identification', v_rest.identification,
      'change_policy', v_rest.change_policy),
    'table', jsonb_build_object('id', v_table.id, 'label', v_table.label, 'reserved_by', v_table.reserved_by),
    'participant', (
      select jsonb_build_object('seat_id', p.seat_id, 'seat_label', s.label, 'display_name', p.display_name)
      from public.session_participants p
      left join public.seats s on s.id = p.seat_id
      where p.session_id = v_session.id and p.user_id = v_user),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label) order by s.position, s.label)
      from public.seats s where s.table_id = v_table.id), '[]'::jsonb)
  );
end;
$$;

-- ===== Comensal: cambia su puesto o nombre dentro de la sesión =====
create function public.update_participant(
  p_session_id uuid,
  p_seat_id uuid default null,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_table_id uuid;
begin
  select table_id into v_table_id from public.table_sessions where id = p_session_id and status = 'open';
  if not found then
    raise exception 'invalid_session';
  end if;
  if p_seat_id is not null then
    perform 1 from public.seats where id = p_seat_id and table_id = v_table_id;
    if not found then
      raise exception 'invalid_seat';
    end if;
  end if;
  update public.session_participants
  set seat_id = coalesce(p_seat_id, seat_id),
      display_name = coalesce(left(nullif(btrim(p_display_name), ''), 60), display_name)
  where session_id = p_session_id and user_id = v_user;
  if not found then
    raise exception 'forbidden';
  end if;
end;
$$;

-- ===== Comensal o personal: agrega platos a la sesión =====
-- p_items: [{ "dish_id": uuid, "quantity": 1, "option_ids": [uuid], "note": "texto" }]
-- Los precios salen siempre de la base de datos, nunca del cliente.
create function public.add_items(
  p_session_id uuid,
  p_items jsonb,
  p_seat_id uuid default null,
  p_for_name text default null
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.table_sessions;
  v_rest public.restaurants;
  v_part public.session_participants;
  v_is_staff boolean;
  v_seat_id uuid;
  v_seat_label text;
  v_for_name text;
  v_el jsonb;
  v_dish public.dishes;
  v_priced jsonb;
  v_qty integer;
  v_ids uuid[] := '{}';
  v_new_id uuid;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'invalid_items';
  end if;

  select * into v_session from public.table_sessions where id = p_session_id and status = 'open';
  if not found then
    raise exception 'invalid_session';
  end if;
  select * into v_rest from public.restaurants where id = v_session.restaurant_id;

  v_is_staff := private.is_member(v_rest.id);
  select * into v_part from public.session_participants
  where session_id = p_session_id and user_id = v_user;

  if not v_is_staff then
    if v_part.user_id is null then
      raise exception 'forbidden';
    end if;
    -- En modo "atendido" solo el personal toma pedidos
    if v_rest.ordering_mode = 'staff' then
      raise exception 'diner_ordering_disabled';
    end if;
  end if;

  -- Límite por sesión para evitar abusos
  if (select count(*) from public.order_items
      where session_id = p_session_id and status <> 'cancelled') + jsonb_array_length(p_items) > 200 then
    raise exception 'too_many_items';
  end if;

  -- Puesto: el comensal usa el suyo salvo que indique otro; el personal elige libremente
  v_seat_id := coalesce(p_seat_id, case when v_is_staff then null else v_part.seat_id end);
  if v_seat_id is not null then
    select label into v_seat_label from public.seats
    where id = v_seat_id and table_id = v_session.table_id;
    if not found then
      raise exception 'invalid_seat';
    end if;
  elsif v_rest.identification = 'seat' then
    raise exception 'seat_required';
  end if;

  v_for_name := left(nullif(btrim(coalesce(p_for_name, case when v_is_staff then null else v_part.display_name end)), ''), 60);

  for v_el in select value from jsonb_array_elements(p_items) loop
    select * into v_dish from public.dishes
    where id = (v_el ->> 'dish_id')::uuid and restaurant_id = v_rest.id and available;
    if not found then
      raise exception 'invalid_dish';
    end if;

    v_qty := least(greatest(coalesce((v_el ->> 'quantity')::integer, 1), 1), 20);
    v_priced := private.price_options(
      v_dish.id,
      array(select jsonb_array_elements_text(coalesce(v_el -> 'option_ids', '[]'::jsonb))::uuid));

    insert into public.order_items (
      session_id, restaurant_id, dish_id, dish_name, base_price_cents, unit_price_cents,
      quantity, options, note, seat_id, seat_label, for_name, added_by, added_by_staff
    ) values (
      p_session_id, v_rest.id, v_dish.id, v_dish.name, v_dish.price_cents,
      v_dish.price_cents + (v_priced ->> 'delta')::integer,
      v_qty, v_priced -> 'options', left(nullif(btrim(v_el ->> 'note'), ''), 200),
      v_seat_id, v_seat_label, v_for_name, v_user, v_is_staff
    ) returning id into v_new_id;
    v_ids := v_ids || v_new_id;
  end loop;

  return v_ids;
end;
$$;

-- ===== Comensal o personal: edita o cancela un plato mientras sea posible =====
-- p_changes admite: { "quantity": 2, "option_ids": [uuid], "note": "sin salsa" }
-- quantity 0 cancela el plato.
create function public.update_item(p_item_id uuid, p_changes jsonb)
returns void
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
  v_is_staff boolean;
  v_priced jsonb;
  v_qty integer;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;

  select * into v_item from public.order_items where id = p_item_id for update;
  if not found then
    raise exception 'invalid_item';
  end if;
  select * into v_session from public.table_sessions where id = v_item.session_id;
  select * into v_rest from public.restaurants where id = v_item.restaurant_id;
  if v_session.status <> 'open' then
    raise exception 'session_closed';
  end if;

  v_is_staff := private.is_member(v_rest.id);
  if not v_is_staff then
    select * into v_part from public.session_participants
    where session_id = v_item.session_id and user_id = v_user;
    -- Puede editar quien lo pidió o quien está sentado en el puesto al que pertenece
    if v_part.user_id is null
       or not (v_item.added_by = v_user or (v_item.seat_id is not null and v_item.seat_id = v_part.seat_id)) then
      raise exception 'forbidden';
    end if;
    if v_rest.ordering_mode = 'staff' then
      raise exception 'diner_ordering_disabled';
    end if;
  end if;

  -- Ventana de edición según la política del restaurante
  if not (v_item.status = 'pending'
          or (v_item.status = 'preparing' and v_rest.change_policy = 'until_ready')) then
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
      -- Si cocina ya había empezado, se marca para que lo vea
      changed_after_start = changed_after_start or v_item.status = 'preparing'
  where id = p_item_id;
end;
$$;

-- ===== Personal: avanza el estado de uno o varios platos =====
-- Transiciones: pending→preparing; pending/preparing→ready; ready/preparing/pending→served;
-- cualquiera no terminado→cancelled. Los locales pequeños pueden saltarse pasos.
create function public.set_items_status(p_item_ids uuid[], p_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_status not in ('preparing', 'ready', 'served', 'cancelled') then
    raise exception 'invalid_status';
  end if;

  update public.order_items i
  set status = p_status
  where i.id = any(p_item_ids)
    and private.is_member(i.restaurant_id)
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

-- ===== Personal: abre (o recupera) la sesión de una mesa para tomar pedidos =====
create function public.staff_open_session(p_table_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.dining_tables;
begin
  select * into v_table from public.dining_tables where id = p_table_id and active;
  if not found or not private.is_member(v_table.restaurant_id) then
    raise exception 'forbidden';
  end if;
  return (private.open_session(v_table)).id;
end;
$$;

-- ===== Personal: cierra la mesa (termina la sesión) =====
create function public.close_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.table_sessions
  set status = 'closed', closed_at = now()
  where id = p_session_id and status = 'open' and private.is_member(restaurant_id);
  if not found then
    raise exception 'forbidden';
  end if;
end;
$$;

-- ===== Público: directorio de restaurantes (con distancia si se envían coordenadas) =====
create function public.list_restaurants(
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit integer default 30
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by (r ->> 'distance_m')::double precision nulls last, r ->> 'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', x.id, 'name', x.name, 'slug', x.slug, 'description', x.description,
      'city', x.city, 'address', x.address, 'ordering_mode', x.ordering_mode,
      'distance_m', case
        when p_lat is null or p_lng is null or x.latitude is null or x.longitude is null then null
        else round((6371000 * 2 * asin(sqrt(
          power(sin(radians(x.latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(x.latitude))
            * power(sin(radians(x.longitude - p_lng) / 2), 2)
        )))::numeric)
      end
    ) as r
    from public.restaurants x
    where x.listed
    limit greatest(1, least(p_limit, 100))
  ) t;
$$;

-- ===== Permisos de ejecución =====
-- Funciones que requieren una sesión (los invitados anónimos también tienen sesión)
revoke execute on function public.join_session(text, uuid, text) from public, anon;
revoke execute on function public.update_participant(uuid, uuid, text) from public, anon;
revoke execute on function public.add_items(uuid, jsonb, uuid, text) from public, anon;
revoke execute on function public.update_item(uuid, jsonb) from public, anon;
revoke execute on function public.set_items_status(uuid[], text) from public, anon;
revoke execute on function public.staff_open_session(uuid) from public, anon;
revoke execute on function public.close_session(uuid) from public, anon;
grant execute on function public.join_session(text, uuid, text) to authenticated;
grant execute on function public.update_participant(uuid, uuid, text) to authenticated;
grant execute on function public.add_items(uuid, jsonb, uuid, text) to authenticated;
grant execute on function public.update_item(uuid, jsonb) to authenticated;
grant execute on function public.set_items_status(uuid[], text) to authenticated;
grant execute on function public.staff_open_session(uuid) to authenticated;
grant execute on function public.close_session(uuid) to authenticated;
-- El directorio es público
revoke execute on function public.list_restaurants(double precision, double precision, integer) from public;
grant execute on function public.list_restaurants(double precision, double precision, integer) to anon, authenticated;
