-- ===== Precios en bolívares: cada local elige cómo mostrarlos y con qué tasa =====
-- Los precios siguen guardándose en dólares (céntimos). Esto solo decide cómo se MUESTRAN.
alter table public.restaurants
  add column price_display text not null default 'usd' check (price_display in ('usd', 'ves', 'both')),
  add column rate_source text not null default 'bcv_usd' check (rate_source in ('bcv_usd', 'bcv_eur', 'manual')),
  -- Tasa fijada a mano por el local (bolívares por dólar); solo se usa con rate_source = 'manual'.
  add column manual_rate numeric(18, 4) check (manual_rate is null or (manual_rate > 0 and manual_rate < 100000000)),
  add column manual_rate_at timestamptz;

-- Los comensales no leen la tabla de restaurantes: este dato público les dice cómo mostrar los precios.
create function public.restaurant_pricing(p_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'price_display', r.price_display, 'rate_source', r.rate_source,
    'manual_rate', r.manual_rate, 'manual_rate_at', r.manual_rate_at)
  from public.restaurants r
  where r.id = p_restaurant_id;
$$;
revoke execute on function public.restaurant_pricing(uuid) from public;
grant execute on function public.restaurant_pricing(uuid) to anon, authenticated;

-- El directorio también incluye cómo mostrar los precios (la ficha pública del restaurante los usa).
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.list_restaurants(double precision, double precision, integer)'::regprocedure) into v_def;
  if position('''ordering_mode'', x.ordering_mode,' in v_def) = 0 then
    raise exception 'patrón no encontrado en list_restaurants';
  end if;
  execute replace(v_def, '''ordering_mode'', x.ordering_mode,',
    '''ordering_mode'', x.ordering_mode, ''price_display'', x.price_display, ''rate_source'', x.rate_source, ''manual_rate'', x.manual_rate, ''manual_rate_at'', x.manual_rate_at,');
end $$;
