-- ===== IVA y extras visibles solo para el mesero =====

-- Los precios se guardan SIN IVA (neto). El IVA lo calcula la app: o ya incluido en lo que se muestra, o sumado en la cuenta.
alter table public.restaurants
  add column vat_percent numeric(5, 2) not null default 0 check (vat_percent >= 0 and vat_percent <= 100),
  add column prices_include_vat boolean not null default false;

-- Un extra puede mostrarse al comensal (básico) o quedar solo para que el mesero lo agregue con su precio.
alter table public.dish_options add column diner_visible boolean not null default true;

drop policy options_select_public on public.dish_options;
create policy options_select_public on public.dish_options
  for select to anon, authenticated
  using (available and diner_visible and exists (
    select 1 from public.dish_option_groups g
    join public.dishes d on d.id = g.dish_id
    where g.id = group_id and d.available));
-- El personal del restaurante ve todos los extras, también los ocultos al comensal.
create policy options_select_staff on public.dish_options
  for select to authenticated
  using (exists (
    select 1 from public.dish_option_groups g
    join public.dishes d on d.id = g.dish_id
    where g.id = group_id and private.is_member(d.restaurant_id)));
create policy option_groups_select_staff on public.dish_option_groups
  for select to authenticated
  using (exists (select 1 from public.dishes d where d.id = dish_id and private.is_member(d.restaurant_id)));

-- Validar opciones: el comensal solo puede elegir las visibles; el personal, todas.
create function private.price_options(p_dish_id uuid, p_option_ids uuid[], p_allow_hidden boolean default false)
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
  where o.id = any(v_ids) and g.dish_id = p_dish_id and o.available
    and (p_allow_hidden or o.diner_visible);

  if v_count <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'invalid_option';
  end if;

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
revoke execute on function private.price_options(uuid, uuid[], boolean) from public, anon, authenticated;

-- Quien toma pedidos (y el cambio que acepta el mesero) puede usar extras ocultos.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.add_items(uuid, jsonb, uuid, text)'::regprocedure) into v_def;
  if position('''[]''::jsonb))::uuid));' in v_def) = 0 then raise exception 'patrón no encontrado en add_items'; end if;
  execute replace(v_def, '''[]''::jsonb))::uuid));', '''[]''::jsonb))::uuid), v_is_staff);');

  select pg_get_functiondef('public.update_item(uuid, jsonb)'::regprocedure) into v_def;
  if position('p_changes -> ''option_ids'')::uuid));' in v_def) = 0 then raise exception 'patrón no encontrado en update_item'; end if;
  execute replace(v_def, 'p_changes -> ''option_ids'')::uuid));', 'p_changes -> ''option_ids'')::uuid), v_is_staff);');

  select pg_get_functiondef('private.apply_item_changes(uuid, jsonb)'::regprocedure) into v_def;
  if position('p_changes -> ''option_ids'')::uuid));' in v_def) = 0 then raise exception 'patrón no encontrado en apply_item_changes'; end if;
  execute replace(v_def, 'p_changes -> ''option_ids'')::uuid));', 'p_changes -> ''option_ids'')::uuid), true);');
end $$;
drop function private.price_options(uuid, uuid[]);

-- Lo que falta por cubrir de cada plato ahora incluye el IVA (por línea, redondeado al céntimo).
create or replace function private.items_remaining(p_session_id uuid, p_item_ids uuid[])
returns table (item_id uuid, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id,
         (round(i.unit_price_cents * i.quantity * (100 + r.vat_percent) / 100)::integer
           - coalesce((select sum(pi.amount_usd_cents) from public.payment_items pi
                       join public.payments p on p.id = pi.payment_id
                       where pi.item_id = i.id and p.status in ('pending', 'confirmed')), 0))::integer
  from public.order_items i
  join public.restaurants r on r.id = i.restaurant_id
  where i.session_id = p_session_id and i.status <> 'cancelled'
    and (p_item_ids is null or i.id = any(p_item_ids));
$$;

-- El comensal necesita el IVA para mostrar los precios.
create or replace function public.restaurant_pricing(p_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'price_display', r.price_display, 'rate_source', r.rate_source,
    'manual_rate', r.manual_rate, 'manual_rate_at', r.manual_rate_at,
    'price_label', r.price_label, 'menu_prices_visible', r.menu_prices_visible,
    'vat_percent', r.vat_percent, 'prices_include_vat', r.prices_include_vat,
    'payment_methods', to_jsonb(r.payment_methods), 'payment_instructions', r.payment_instructions)
  from public.restaurants r
  where r.id = p_restaurant_id;
$$;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.list_restaurants(double precision, double precision, integer)'::regprocedure) into v_def;
  if position('''price_label'', x.price_label,' in v_def) = 0 then
    raise exception 'patrón no encontrado en list_restaurants';
  end if;
  execute replace(v_def, '''price_label'', x.price_label,',
    '''price_label'', x.price_label, ''vat_percent'', x.vat_percent, ''prices_include_vat'', x.prices_include_vat,');
end $$;
