-- Inventario, importación masiva (menú e inventario) y claves de API.
--
-- Todo lo que cambia datos pasa por funciones: así cada movimiento de stock queda registrado y la
-- importación del panel y la API pública usan exactamente la misma lógica.

-- ---------------------------------------------------------------- permisos nuevos
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
        when 'menu.edit'         then m.role in ('owner', 'manager')
        when 'inventory.edit'    then m.role in ('owner', 'manager')
        when 'inventory.adjust'  then m.role in ('owner', 'manager', 'kitchen')
        when 'tables.edit'       then m.role in ('owner', 'manager', 'host')
        when 'settings.edit'     then m.role in ('owner', 'manager')
        when 'team.manage'       then m.role in ('owner', 'manager')
        when 'orders.take'       then m.role in ('owner', 'manager', 'host', 'waiter')
        when 'orders.kitchen'    then m.role in ('owner', 'manager', 'kitchen', 'waiter')
        when 'orders.serve'      then m.role in ('owner', 'manager', 'host', 'waiter')
        when 'orders.cancel'     then m.role in ('owner', 'manager', 'waiter', 'kitchen')
        when 'session.close'     then m.role in ('owner', 'manager', 'cashier')
                                      or (m.role in ('host', 'waiter') and exists (
                                            select 1 from public.restaurants r
                                            where r.id = p_restaurant_id and r.table_close = 'staff'))
        when 'payments.manage'   then m.role in ('owner', 'manager', 'host', 'waiter', 'cashier')
        when 'orders.view'       then true
        else false
      end
  );
$$;

-- ---------------------------------------------------------------- utilidades
-- Texto -> identificador: sin tildes, minúsculas, guiones.
create function private.slugify(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(trim(both '-' from regexp_replace(
    translate(lower(coalesce(p, '')), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'),
    '[^a-z0-9]+', '-', 'g')), 60);
$$;

-- Número desde texto; acepta coma decimal ("12,50") y rechaza lo que no es un número.
create function private.to_num(p text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  if btrim(p) !~ '^-?[0-9]+([.,][0-9]+)?$' then
    raise exception 'Número no válido: "%"', left(p, 30);
  end if;
  return replace(btrim(p), ',', '.')::numeric;
end;
$$;

-- Sí/no desde texto (acepta "sí", "no", "1", "0", "true", "false", "activo"…).
create function private.to_bool(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  case lower(btrim(p))
    when 'true', 't', '1', 'si', 'sí', 'yes', 'y', 'activo', 'disponible' then return true;
    when 'false', 'f', '0', 'no', 'n', 'inactivo', 'agotado', 'pausado' then return false;
    else raise exception 'Valor sí/no no válido: "%"', left(p, 30);
  end case;
end;
$$;

-- ---------------------------------------------------------------- inventario
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  sku text not null check (sku ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(sku) <= 60),
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'General' check (char_length(category) between 1 and 40),
  unit text not null default 'u' check (unit in ('u', 'kg', 'g', 'l', 'ml')),
  stock numeric(14, 3) not null default 0 check (abs(stock) < 1000000000),
  min_stock numeric(14, 3) not null default 0 check (min_stock >= 0 and min_stock < 1000000000),
  -- Costo por unidad, SIN IVA, en la moneda base (céntimos), igual que los precios del menú.
  cost_cents integer not null default 0 check (cost_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, sku)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  delta numeric(14, 3) not null,
  stock_after numeric(14, 3) not null,
  reason text not null check (reason in ('compra', 'merma', 'ajuste', 'consumo', 'importacion', 'inicial')),
  note text check (char_length(note) <= 200),
  source text not null default 'panel' check (source in ('panel', 'importacion', 'api')),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_item_idx on public.inventory_movements (item_id, created_at desc);
create index inventory_movements_restaurant_idx on public.inventory_movements (restaurant_id, created_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

-- Lectura para quien puede ajustar stock; escribir solo por las funciones de abajo (salvo borrar).
create policy "inventory_items_select" on public.inventory_items
  for select to authenticated using (private.has_permission(restaurant_id, 'inventory.adjust'));
create policy "inventory_items_delete" on public.inventory_items
  for delete to authenticated using (private.has_permission(restaurant_id, 'inventory.edit'));
create policy "inventory_movements_select" on public.inventory_movements
  for select to authenticated using (private.has_permission(restaurant_id, 'inventory.adjust'));

revoke insert, update on public.inventory_items from authenticated, anon;
revoke insert, update, delete on public.inventory_movements from authenticated, anon;

-- Cambia el stock de un artículo y deja el movimiento anotado. Bloquea la fila para no perder cuentas.
create function private.inventory_adjust(
  p_item_id uuid, p_delta numeric, p_reason text, p_note text, p_source text, p_user uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventory_items;
  v_new numeric;
begin
  select * into v_item from public.inventory_items where id = p_item_id for update;
  if not found then raise exception 'item_not_found'; end if;
  v_new := v_item.stock + p_delta;
  if abs(v_new) >= 1000000000 then raise exception 'La cantidad es demasiado grande'; end if;

  update public.inventory_items set stock = v_new, updated_at = now() where id = p_item_id;
  insert into public.inventory_movements (restaurant_id, item_id, delta, stock_after, reason, note, source, user_id)
  values (v_item.restaurant_id, p_item_id, p_delta, v_new, p_reason, left(p_note, 200), p_source, p_user);
  return v_new;
end;
$$;

-- Crea o actualiza artículos. Cada fila es un objeto; la clave es `sku` (o el nombre si no hay).
-- Solo cambia los campos presentes en la fila. Cada fila va en su propia sub-transacción: una mala
-- no tumba las demás y se informa con su número. Devuelve {created, updated, errors:[{row,message}]}.
create function private.inventory_apply(p_rest uuid, p_rows jsonb, p_source text, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  n int := 0;
  v_created int := 0;
  v_updated int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_sku text;
  v_item public.inventory_items;
  v_stock numeric;
  v_unit text;
  v_reason text := case when p_source = 'panel' then 'ajuste' else 'importacion' end;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'rows_must_be_array'; end if;
  if jsonb_array_length(p_rows) > 2000 then raise exception 'too_many_rows'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    begin
      if jsonb_typeof(r) <> 'object' then raise exception 'La fila no es un objeto'; end if;
      v_sku := coalesce(nullif(private.slugify(r->>'sku'), ''), private.slugify(r->>'name'));
      if v_sku = '' then raise exception 'Falta el nombre o el código (sku)'; end if;
      v_unit := nullif(lower(btrim(r->>'unit')), '');

      select * into v_item from public.inventory_items where restaurant_id = p_rest and sku = v_sku for update;
      if not found then
        if nullif(btrim(r->>'name'), '') is null then raise exception 'Falta el nombre'; end if;
        v_stock := coalesce(private.to_num(r->>'stock'), 0);
        insert into public.inventory_items (restaurant_id, sku, name, category, unit, stock, min_stock, cost_cents, active)
        values (
          p_rest, v_sku, btrim(r->>'name'),
          coalesce(nullif(btrim(r->>'category'), ''), 'General'),
          coalesce(v_unit, 'u'),
          v_stock,
          coalesce(private.to_num(r->>'min_stock'), 0),
          coalesce(round(private.to_num(r->>'cost') * 100)::int, 0),
          coalesce(private.to_bool(r->>'active'), true)
        ) returning * into v_item;
        if v_stock <> 0 then
          insert into public.inventory_movements (restaurant_id, item_id, delta, stock_after, reason, source, user_id)
          values (p_rest, v_item.id, v_stock, v_stock, 'inicial', p_source, p_user);
        end if;
        v_created := v_created + 1;
      else
        v_stock := private.to_num(r->>'stock');
        update public.inventory_items set
          name = coalesce(nullif(btrim(r->>'name'), ''), name),
          category = coalesce(nullif(btrim(r->>'category'), ''), category),
          unit = coalesce(v_unit, unit),
          min_stock = coalesce(private.to_num(r->>'min_stock'), min_stock),
          cost_cents = coalesce(round(private.to_num(r->>'cost') * 100)::int, cost_cents),
          active = coalesce(private.to_bool(r->>'active'), active),
          updated_at = now()
        where id = v_item.id;
        if v_stock is not null and v_stock <> v_item.stock then
          perform private.inventory_adjust(v_item.id, v_stock - v_item.stock, v_reason, null, p_source, p_user);
        end if;
        v_updated := v_updated + 1;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', n, 'message', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'errors', v_errors);
end;
$$;

-- Crea o actualiza platos del menú. Clave: `code` (el identificador del plato) o, si falta, el nombre.
create function private.dishes_apply(p_rest uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  n int := 0;
  v_created int := 0;
  v_updated int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_slug text;
  v_id uuid;
  v_pos int;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'rows_must_be_array'; end if;
  if jsonb_array_length(p_rows) > 2000 then raise exception 'too_many_rows'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    begin
      if jsonb_typeof(r) <> 'object' then raise exception 'La fila no es un objeto'; end if;
      v_slug := coalesce(nullif(private.slugify(r->>'code'), ''), private.slugify(r->>'name'));
      if v_slug = '' then raise exception 'Falta el nombre o el código'; end if;

      select id into v_id from public.dishes where restaurant_id = p_rest and slug = v_slug for update;
      if v_id is null then
        if nullif(btrim(r->>'name'), '') is null then raise exception 'Falta el nombre'; end if;
        if nullif(btrim(r->>'category'), '') is null then raise exception 'Falta la categoría'; end if;
        if nullif(btrim(r->>'price'), '') is null then raise exception 'Falta el precio'; end if;
        select coalesce(max(position), 0) + 1 into v_pos from public.dishes where restaurant_id = p_rest;
        insert into public.dishes (restaurant_id, slug, name, category, price_cents, description, emoji, available, position)
        values (
          p_rest, v_slug, btrim(r->>'name'), btrim(r->>'category'),
          round(private.to_num(r->>'price') * 100)::int,
          coalesce(btrim(r->>'description'), ''),
          coalesce(nullif(btrim(r->>'emoji'), ''), '🍽️'),
          coalesce(private.to_bool(r->>'available'), true),
          v_pos
        );
        v_created := v_created + 1;
      else
        update public.dishes set
          name = coalesce(nullif(btrim(r->>'name'), ''), name),
          category = coalesce(nullif(btrim(r->>'category'), ''), category),
          price_cents = coalesce(round(private.to_num(r->>'price') * 100)::int, price_cents),
          description = coalesce(btrim(r->>'description'), description),
          emoji = coalesce(nullif(btrim(r->>'emoji'), ''), emoji),
          available = coalesce(private.to_bool(r->>'available'), available)
        where id = v_id;
        v_updated := v_updated + 1;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', n, 'message', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'errors', v_errors);
end;
$$;

-- ---------------------------------------------------------------- funciones para el panel
create function public.import_menu(p_restaurant_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission(p_restaurant_id, 'menu.edit') then raise exception 'forbidden'; end if;
  return private.dishes_apply(p_restaurant_id, p_rows);
end;
$$;

-- p_source = 'panel' para ediciones sueltas desde la pantalla, 'importacion' para archivos.
create function public.import_inventory(p_restaurant_id uuid, p_rows jsonb, p_source text default 'importacion')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission(p_restaurant_id, 'inventory.edit') then raise exception 'forbidden'; end if;
  if p_source not in ('panel', 'importacion') then raise exception 'invalid_source'; end if;
  return private.inventory_apply(p_restaurant_id, p_rows, p_source, (select auth.uid()));
end;
$$;

create function public.adjust_inventory(p_item_id uuid, p_delta numeric, p_reason text, p_note text default null)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rest uuid;
begin
  select restaurant_id into v_rest from public.inventory_items where id = p_item_id;
  if v_rest is null or not private.has_permission(v_rest, 'inventory.adjust') then raise exception 'forbidden'; end if;
  if p_reason not in ('compra', 'merma', 'ajuste', 'consumo') then raise exception 'invalid_reason'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'La cantidad no puede ser cero'; end if;
  return private.inventory_adjust(p_item_id, p_delta, p_reason, p_note, 'panel', (select auth.uid()));
end;
$$;

-- ---------------------------------------------------------------- claves de API
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  prefix text not null,
  key_hash text not null unique,
  can_write boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_keys_restaurant_idx on public.api_keys (restaurant_id);

alter table public.api_keys enable row level security;
create policy "api_keys_select" on public.api_keys
  for select to authenticated using (private.has_permission(restaurant_id, 'settings.edit'));

-- El panel nunca ve el hash; solo los datos para listar y revocar.
revoke all on public.api_keys from authenticated, anon;
grant select (id, restaurant_id, name, prefix, can_write, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;

-- Crea una clave y la devuelve UNA sola vez. En la base solo queda su huella SHA-256.
create function public.create_api_key(p_restaurant_id uuid, p_name text, p_can_write boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := 'apt_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not private.has_permission(p_restaurant_id, 'settings.edit') then raise exception 'forbidden'; end if;
  if (select count(*) from public.api_keys where restaurant_id = p_restaurant_id and revoked_at is null) >= 10 then
    raise exception 'Ya hay 10 claves activas; revoca alguna primero';
  end if;
  insert into public.api_keys (restaurant_id, name, prefix, key_hash, can_write, created_by)
  values (
    p_restaurant_id, btrim(p_name), left(v_key, 10),
    encode(extensions.digest(v_key, 'sha256'), 'hex'), coalesce(p_can_write, false), (select auth.uid())
  );
  return v_key;
end;
$$;

create function public.revoke_api_key(p_key_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rest uuid;
begin
  select restaurant_id into v_rest from public.api_keys where id = p_key_id;
  if v_rest is null or not private.has_permission(v_rest, 'settings.edit') then raise exception 'forbidden'; end if;
  update public.api_keys set revoked_at = now() where id = p_key_id and revoked_at is null;
end;
$$;

-- Comprueba una clave y devuelve el restaurante al que pertenece.
create function private.api_auth(p_key text, p_write boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.api_keys;
begin
  select * into v_row from public.api_keys
  where key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex') and revoked_at is null;
  if not found then raise exception 'invalid_api_key'; end if;
  if p_write and not v_row.can_write then raise exception 'api_key_read_only'; end if;
  if v_row.last_used_at is null or v_row.last_used_at < now() - interval '1 minute' then
    update public.api_keys set last_used_at = now() where id = v_row.id;
  end if;
  return v_row.restaurant_id;
end;
$$;

-- ---------------------------------------------------------------- funciones de la API pública
-- Precios y costos salen y entran como números decimales SIN IVA, en la moneda base del local.
create function public.api_menu_list(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rest uuid := private.api_auth(p_key, false);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', d.slug, 'name', d.name, 'category', d.category, 'price', d.price_cents / 100.0,
      'description', d.description, 'emoji', d.emoji, 'available', d.available
    ) order by d.position, d.name)
    from public.dishes d where d.restaurant_id = v_rest
  ), '[]'::jsonb);
end;
$$;

create function public.api_menu_upsert(p_key text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.dishes_apply(private.api_auth(p_key, true), p_rows);
end;
$$;

create function public.api_inventory_list(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rest uuid := private.api_auth(p_key, false);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'sku', i.sku, 'name', i.name, 'category', i.category, 'unit', i.unit, 'stock', i.stock,
      'min_stock', i.min_stock, 'cost', i.cost_cents / 100.0, 'active', i.active,
      'low_stock', i.min_stock > 0 and i.stock <= i.min_stock, 'updated_at', i.updated_at
    ) order by i.category, i.name)
    from public.inventory_items i where i.restaurant_id = v_rest
  ), '[]'::jsonb);
end;
$$;

create function public.api_inventory_upsert(p_key text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.inventory_apply(private.api_auth(p_key, true), p_rows, 'api', null);
end;
$$;

create function public.api_inventory_adjust(p_key text, p_sku text, p_delta numeric, p_reason text, p_note text default null)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rest uuid := private.api_auth(p_key, true);
  v_id uuid;
begin
  if p_reason not in ('compra', 'merma', 'ajuste', 'consumo') then raise exception 'invalid_reason'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'La cantidad no puede ser cero'; end if;
  select id into v_id from public.inventory_items where restaurant_id = v_rest and sku = private.slugify(p_sku);
  if v_id is null then raise exception 'item_not_found'; end if;
  return private.inventory_adjust(v_id, p_delta, p_reason, p_note, 'api', null);
end;
$$;

-- ---------------------------------------------------------------- permisos de ejecución
-- Las funciones internas no se llaman desde fuera: solo las usan las funciones públicas de arriba.
revoke execute on function
  private.slugify(text), private.to_num(text), private.to_bool(text),
  private.inventory_adjust(uuid, numeric, text, text, text, uuid),
  private.inventory_apply(uuid, jsonb, text, uuid),
  private.dishes_apply(uuid, jsonb),
  private.api_auth(text, boolean)
from public, anon, authenticated;

revoke execute on function
  public.import_menu(uuid, jsonb),
  public.import_inventory(uuid, jsonb, text),
  public.adjust_inventory(uuid, numeric, text, text),
  public.create_api_key(uuid, text, boolean),
  public.revoke_api_key(uuid)
from public, anon;
grant execute on function
  public.import_menu(uuid, jsonb),
  public.import_inventory(uuid, jsonb, text),
  public.adjust_inventory(uuid, numeric, text, text),
  public.create_api_key(uuid, text, boolean),
  public.revoke_api_key(uuid)
to authenticated;

-- La API pública se llama sin sesión: la propia clave es la credencial.
revoke execute on function
  public.api_menu_list(text), public.api_menu_upsert(text, jsonb),
  public.api_inventory_list(text), public.api_inventory_upsert(text, jsonb),
  public.api_inventory_adjust(text, text, numeric, text, text)
from public;
grant execute on function
  public.api_menu_list(text), public.api_menu_upsert(text, jsonb),
  public.api_inventory_list(text), public.api_inventory_upsert(text, jsonb),
  public.api_inventory_adjust(text, text, numeric, text, text)
to anon, authenticated;
