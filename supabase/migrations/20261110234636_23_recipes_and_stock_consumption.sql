-- Recetas por plato y descuento automático del inventario.
--
-- Regla: el stock se descuenta cuando cocina EMPIEZA a preparar el plato (estado «preparing», o «ready»/«served»
-- si se salta ese paso). Cancelar antes de empezar no descuenta nada. Cancelar después NO devuelve el stock
-- (se asume merma); si se aumenta la cantidad después de empezar, solo se descuenta la diferencia.
-- El descuento vive en un disparador de la base, así que cubre a cocina, mesero, caja y cualquier otro camino.

-- Los movimientos hechos por pedidos se distinguen de los manuales, de archivo y de API.
alter table public.inventory_movements drop constraint inventory_movements_source_check;
alter table public.inventory_movements
  add constraint inventory_movements_source_check check (source in ('panel', 'importacion', 'api', 'pedido'));

-- Porciones de cada línea de pedido que ya descontaron stock (evita descontar dos veces).
alter table public.order_items add column stock_consumed_qty integer not null default 0 check (stock_consumed_qty >= 0);
-- Lo que ya se había empezado antes de esta función no se descuenta de forma retroactiva.
update public.order_items set stock_consumed_qty = quantity where status in ('preparing', 'ready', 'served');

-- Receta: cuánto de cada artículo del inventario lleva UNA porción del plato (en la unidad del artículo).
create table public.dish_ingredients (
  dish_id uuid not null references public.dishes(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  quantity numeric(14, 3) not null check (quantity > 0 and quantity < 1000000),
  primary key (dish_id, item_id)
);
create index dish_ingredients_item_idx on public.dish_ingredients (item_id);

alter table public.dish_ingredients enable row level security;
create policy "dish_ingredients_select" on public.dish_ingredients
  for select to authenticated using (private.has_permission(restaurant_id, 'inventory.adjust'));
revoke all on public.dish_ingredients from anon, authenticated;
grant select on public.dish_ingredients to authenticated;

-- Reemplaza la receta completa de un plato. p_lines: [{"item_id": "...", "quantity": 0.25}, ...]
-- Una lista vacía deja el plato sin receta (no descuenta nada).
create function public.set_dish_recipe(p_dish_id uuid, p_lines jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rest uuid;
  v_count integer;
begin
  select restaurant_id into v_rest from public.dishes where id = p_dish_id;
  if v_rest is null or not private.has_permission(v_rest, 'menu.edit') then raise exception 'forbidden'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'invalid_lines'; end if;
  if jsonb_array_length(p_lines) > 30 then raise exception 'too_many_rows'; end if;

  if (select count(distinct l ->> 'item_id') from jsonb_array_elements(p_lines) l) <> jsonb_array_length(p_lines) then
    raise exception 'duplicate_ingredient';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    where not exists (
      select 1 from public.inventory_items i
      where i.id = (l ->> 'item_id')::uuid and i.restaurant_id = v_rest)
  ) then
    raise exception 'invalid_ingredient';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    where coalesce(private.to_num(l ->> 'quantity'), 0) <= 0
  ) then
    raise exception 'invalid_quantity';
  end if;

  delete from public.dish_ingredients where dish_id = p_dish_id;
  insert into public.dish_ingredients (dish_id, item_id, restaurant_id, quantity)
  select p_dish_id, (l ->> 'item_id')::uuid, v_rest, private.to_num(l ->> 'quantity')
  from jsonb_array_elements(p_lines) l;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.set_dish_recipe(uuid, jsonb) from public, anon;
grant execute on function public.set_dish_recipe(uuid, jsonb) to authenticated;

-- Descuenta el stock cuando un plato empieza a prepararse. Corre como dueño de la base porque quien
-- cambia el estado (cocina, mesero) no tiene permiso para tocar el inventario directamente.
create function private.consume_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta integer;
  r record;
begin
  if new.status in ('preparing', 'ready', 'served') and new.dish_id is not null then
    -- Solo se descuenta lo que aún no se había descontado; nunca se devuelve por reducir la cantidad.
    v_delta := new.quantity - new.stock_consumed_qty;
    if v_delta > 0 then
      begin
        for r in
          select di.item_id, di.quantity from public.dish_ingredients di
          where di.dish_id = new.dish_id order by di.item_id
        loop
          perform private.inventory_adjust(
            r.item_id, -(r.quantity * v_delta), 'consumo',
            'Pedido: ' || new.dish_name || ' x' || v_delta, 'pedido', (select auth.uid()));
        end loop;
        new.stock_consumed_qty := new.quantity;
      exception when others then
        -- El inventario nunca debe frenar a cocina. Si falla, no se marca como descontado y se reintenta
        -- en el siguiente cambio del plato.
        null;
      end;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.consume_stock() from public, anon, authenticated;

create trigger order_items_consume_stock
  before insert or update of status, quantity on public.order_items
  for each row execute function private.consume_stock();
