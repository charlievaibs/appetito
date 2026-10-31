alter table public.restaurants
  add column ordering_mode text not null default 'staff'
    check (ordering_mode in ('staff', 'qr_optional', 'qr')),
  add column identification text not null default 'table'
    check (identification in ('table', 'seat', 'reservation'));

-- El restaurante demo se usa para probar el flujo de QR completo
update public.restaurants set ordering_mode = 'qr' where slug = 'demo';

-- Lógica común de creación de pedido (no expuesta por la API)
create function private.insert_order(
  p_table_id uuid,
  p_seat_id uuid,
  p_items jsonb,
  p_diner_name text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.dining_tables;
  v_seat public.seats;
  v_order_id uuid;
  v_inserted integer;
  v_expected integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'invalid_items';
  end if;

  select * into v_table from public.dining_tables where id = p_table_id and active;
  if not found then
    raise exception 'invalid_table';
  end if;

  if p_seat_id is not null then
    select * into v_seat from public.seats where id = p_seat_id and table_id = v_table.id;
    if not found then
      raise exception 'invalid_seat';
    end if;
  end if;

  insert into public.orders (
    restaurant_id, table_id, table_label, seat_id, seat_label, diner_name, note, total_cents
  ) values (
    v_table.restaurant_id, v_table.id, v_table.label, v_seat.id, v_seat.label,
    left(nullif(btrim(p_diner_name), ''), 60),
    left(nullif(btrim(p_note), ''), 300),
    0
  ) returning id into v_order_id;

  insert into public.order_items (order_id, dish_id, dish_name, unit_price_cents, quantity)
  select v_order_id, d.id, d.name, d.price_cents, least(l.qty, 20)
  from (
    select (e ->> 'dish_id')::uuid as dish_id,
           sum(greatest((e ->> 'quantity')::integer, 1))::integer as qty
    from jsonb_array_elements(p_items) e
    group by 1
  ) l
  join public.dishes d
    on d.id = l.dish_id
   and d.restaurant_id = v_table.restaurant_id
   and d.available;
  get diagnostics v_inserted = row_count;

  select count(distinct e ->> 'dish_id') into v_expected from jsonb_array_elements(p_items) e;
  if v_inserted <> v_expected then
    raise exception 'invalid_dish';
  end if;

  update public.orders
  set total_cents = (select sum(unit_price_cents * quantity) from public.order_items where order_id = v_order_id)
  where id = v_order_id;

  return v_order_id;
end;
$$;
revoke execute on function private.insert_order(uuid, uuid, jsonb, text, text) from public;

-- Comensal por QR: respeta el modo del restaurante
create or replace function public.place_order(
  p_token text,
  p_items jsonb,
  p_seat_id uuid default null,
  p_diner_name text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seat public.seats;
  v_table public.dining_tables;
  v_rest public.restaurants;
  v_seat_id uuid;
begin
  select * into v_seat from public.seats where qr_token = p_token;
  if found then
    select * into v_table from public.dining_tables where id = v_seat.table_id;
  else
    select * into v_table from public.dining_tables where qr_token = p_token;
  end if;
  if not found or not v_table.active then
    raise exception 'invalid_qr';
  end if;

  select * into v_rest from public.restaurants where id = v_table.restaurant_id;
  if v_rest.ordering_mode = 'staff' then
    raise exception 'qr_ordering_disabled';
  end if;

  -- Con QR de puesto el puesto lo fija el QR; con QR de mesa es opcional (o exigido)
  v_seat_id := coalesce(v_seat.id, p_seat_id);
  if v_rest.identification = 'seat' and v_seat_id is null then
    raise exception 'seat_required';
  end if;

  return private.insert_order(v_table.id, v_seat_id, p_items, p_diner_name, p_note);
end;
$$;

-- Personal: toma un pedido en nombre de una mesa
create function public.staff_place_order(
  p_table_id uuid,
  p_items jsonb,
  p_seat_id uuid default null,
  p_diner_name text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from public.dining_tables where id = p_table_id;
  if not found or not private.is_member(v_restaurant) then
    raise exception 'forbidden';
  end if;
  return private.insert_order(p_table_id, p_seat_id, p_items, p_diner_name, p_note);
end;
$$;
revoke execute on function public.staff_place_order(uuid, jsonb, uuid, text, text) from public, anon;
grant execute on function public.staff_place_order(uuid, jsonb, uuid, text, text) to authenticated;

-- resolve_qr ahora también informa del modo y la identificación
create or replace function public.resolve_qr(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_seat public.seats;
  v_table public.dining_tables;
  v_rest public.restaurants;
begin
  select * into v_seat from public.seats where qr_token = p_token;
  if found then
    select * into v_table from public.dining_tables where id = v_seat.table_id;
  else
    select * into v_table from public.dining_tables where qr_token = p_token;
  end if;
  if not found or not v_table.active then
    return null;
  end if;
  select * into v_rest from public.restaurants where id = v_table.restaurant_id;
  return jsonb_build_object(
    'restaurant', jsonb_build_object(
      'id', v_rest.id, 'name', v_rest.name, 'slug', v_rest.slug,
      'ordering_mode', v_rest.ordering_mode, 'identification', v_rest.identification),
    'table', jsonb_build_object('id', v_table.id, 'label', v_table.label, 'reserved_by', v_table.reserved_by),
    'seat', case when v_seat.id is null then null
                 else jsonb_build_object('id', v_seat.id, 'label', v_seat.label) end,
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label) order by s.position, s.label)
      from public.seats s where s.table_id = v_table.id
    ), '[]'::jsonb)
  );
end;
$$;
