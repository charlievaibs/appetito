alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.dishes enable row level security;
alter table public.dining_tables enable row level security;
alter table public.seats enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Privilegios mínimos: los comensales (anon) solo leen platos disponibles.
revoke all on all tables in schema public from anon;
grant select on public.dishes to anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
-- Los pedidos solo se crean por funciones; el personal solo puede cambiar el estado.
revoke insert, delete, update on public.orders from authenticated;
grant update (status) on public.orders to authenticated;
revoke insert, update, delete on public.order_items from authenticated;

-- Ayudantes de pertenencia
create function public.is_member(p_restaurant_id uuid)
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
  );
$$;

create function public.is_owner(p_restaurant_id uuid)
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
      and m.role = 'owner'
  );
$$;

revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;

-- restaurants
create policy restaurants_select_members on public.restaurants
  for select to authenticated using (public.is_member(id));
create policy restaurants_update_owner on public.restaurants
  for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
create policy restaurants_delete_owner on public.restaurants
  for delete to authenticated using (public.is_owner(id));

-- restaurant_members
create policy members_select on public.restaurant_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner(restaurant_id));
create policy members_insert_owner on public.restaurant_members
  for insert to authenticated
  with check (public.is_owner(restaurant_id) and role = 'staff');
create policy members_delete_owner on public.restaurant_members
  for delete to authenticated
  using (public.is_owner(restaurant_id) and role = 'staff');

-- dishes: el menú disponible es público; el personal gestiona todo
create policy dishes_select_public on public.dishes
  for select to anon, authenticated using (available);
create policy dishes_select_staff on public.dishes
  for select to authenticated using (public.is_member(restaurant_id));
create policy dishes_insert_staff on public.dishes
  for insert to authenticated with check (public.is_member(restaurant_id));
create policy dishes_update_staff on public.dishes
  for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));
create policy dishes_delete_staff on public.dishes
  for delete to authenticated using (public.is_member(restaurant_id));

-- dining_tables
create policy tables_select_staff on public.dining_tables
  for select to authenticated using (public.is_member(restaurant_id));
create policy tables_insert_staff on public.dining_tables
  for insert to authenticated with check (public.is_member(restaurant_id));
create policy tables_update_staff on public.dining_tables
  for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));
create policy tables_delete_staff on public.dining_tables
  for delete to authenticated using (public.is_member(restaurant_id));

-- seats (a través de su mesa)
create policy seats_select_staff on public.seats
  for select to authenticated
  using (exists (select 1 from public.dining_tables t
                 where t.id = table_id and public.is_member(t.restaurant_id)));
create policy seats_insert_staff on public.seats
  for insert to authenticated
  with check (exists (select 1 from public.dining_tables t
                      where t.id = table_id and public.is_member(t.restaurant_id)));
create policy seats_update_staff on public.seats
  for update to authenticated
  using (exists (select 1 from public.dining_tables t
                 where t.id = table_id and public.is_member(t.restaurant_id)))
  with check (exists (select 1 from public.dining_tables t
                      where t.id = table_id and public.is_member(t.restaurant_id)));
create policy seats_delete_staff on public.seats
  for delete to authenticated
  using (exists (select 1 from public.dining_tables t
                 where t.id = table_id and public.is_member(t.restaurant_id)));

-- orders / order_items: el personal solo lee y cambia el estado
create policy orders_select_staff on public.orders
  for select to authenticated using (public.is_member(restaurant_id));
create policy orders_update_staff on public.orders
  for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));
create policy order_items_select_staff on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_id and public.is_member(o.restaurant_id)));

-- Crear un restaurante (queda como dueño quien lo crea)
create function public.create_restaurant(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null or coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'true' then
    raise exception 'auth_required';
  end if;
  insert into public.restaurants (name, slug) values (btrim(p_name), lower(btrim(p_slug)))
  returning id into v_id;
  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (v_id, v_user, 'owner');
  return v_id;
end;
$$;

revoke execute on function public.create_restaurant(text, text) from public, anon;
grant execute on function public.create_restaurant(text, text) to authenticated;

-- Comensal: resuelve un QR (de mesa o de puesto)
create function public.resolve_qr(p_token text)
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
    'restaurant', jsonb_build_object('id', v_rest.id, 'name', v_rest.name, 'slug', v_rest.slug),
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

-- Comensal: crea un pedido. Los precios salen de la base de datos, nunca del cliente.
create function public.place_order(
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
  v_chosen public.seats;
  v_order_id uuid;
  v_inserted integer;
  v_expected integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'invalid_items';
  end if;

  select * into v_seat from public.seats where qr_token = p_token;
  if found then
    select * into v_table from public.dining_tables where id = v_seat.table_id;
    v_chosen := v_seat;
  else
    select * into v_table from public.dining_tables where qr_token = p_token;
  end if;
  if not found or not v_table.active then
    raise exception 'invalid_qr';
  end if;

  -- Con QR de mesa, el comensal puede indicar (opcional) su puesto
  if v_seat.id is null and p_seat_id is not null then
    select * into v_chosen from public.seats
    where id = p_seat_id and table_id = v_table.id;
    if not found then
      raise exception 'invalid_seat';
    end if;
  end if;

  insert into public.orders (
    restaurant_id, table_id, table_label, seat_id, seat_label, diner_name, note, total_cents
  ) values (
    v_table.restaurant_id, v_table.id, v_table.label, v_chosen.id, v_chosen.label,
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

-- Comensal: consulta el estado de su pedido (el id es un uuid imposible de adivinar)
create function public.get_order(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'table_label', o.table_label,
    'seat_label', o.seat_label,
    'diner_name', o.diner_name,
    'total_cents', o.total_cents,
    'created_at', o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.dish_name, 'quantity', i.quantity, 'unit_price_cents', i.unit_price_cents))
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_order_id;
$$;

revoke execute on function public.resolve_qr(text) from public;
revoke execute on function public.place_order(text, jsonb, uuid, text, text) from public;
revoke execute on function public.get_order(uuid) from public;
grant execute on function public.resolve_qr(text) to anon, authenticated;
grant execute on function public.place_order(text, jsonb, uuid, text, text) to anon, authenticated;
grant execute on function public.get_order(uuid) to anon, authenticated;

-- Pedidos en vivo para el personal
alter publication supabase_realtime add table public.orders;
