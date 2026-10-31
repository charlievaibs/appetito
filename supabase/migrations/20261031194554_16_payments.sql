-- ===== Cobros: registrar quién paga qué (la app NO procesa dinero; organiza y deja constancia) =====

-- Métodos que acepta cada local y sus instrucciones (datos de pago móvil, Zelle, etc.).
alter table public.restaurants
  add column payment_methods text[] not null default array['cash', 'pago_movil', 'card_pos', 'transfer', 'zelle'],
  add column payment_instructions text check (payment_instructions is null or char_length(payment_instructions) <= 500),
  add constraint restaurants_payment_methods_valid
    check (payment_methods <@ array['cash', 'pago_movil', 'card_pos', 'transfer', 'zelle', 'other']);

-- Nuevo permiso: cobrar (confirmar pagos y registrar cobros). Mismos roles que cierran mesa.
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
      and case p_permission
        when 'menu.edit'       then m.role in ('owner', 'manager')
        when 'tables.edit'     then m.role in ('owner', 'manager', 'host')
        when 'settings.edit'   then m.role in ('owner', 'manager')
        when 'team.manage'     then m.role in ('owner', 'manager')
        when 'orders.take'     then m.role in ('owner', 'manager', 'host', 'waiter')
        when 'orders.kitchen'  then m.role in ('owner', 'manager', 'kitchen', 'waiter')
        when 'orders.serve'    then m.role in ('owner', 'manager', 'host', 'waiter')
        when 'orders.cancel'   then m.role in ('owner', 'manager', 'waiter', 'kitchen')
        when 'session.close'   then m.role in ('owner', 'manager', 'host', 'waiter', 'cashier')
        when 'payments.manage' then m.role in ('owner', 'manager', 'host', 'waiter', 'cashier')
        when 'orders.view'     then true
        else false
      end
  );
$$;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  payer_name text check (char_length(payer_name) <= 60),
  method text not null check (method in ('cash', 'pago_movil', 'card_pos', 'transfer', 'zelle', 'other')),
  reference text check (char_length(reference) <= 60),
  -- Valor que cubre este pago, siempre en dólares (la moneda base de los precios).
  amount_usd_cents integer not null check (amount_usd_cents > 0),
  -- Moneda en la que se pagó de verdad y cuánto (en céntimos de esa moneda), con la tasa usada si fue en bolívares.
  currency text not null default 'USD' check (currency in ('USD', 'VES')),
  amount_paid_cents bigint not null check (amount_paid_cents > 0),
  rate numeric(18, 4) check (rate is null or (rate > 0 and rate < 100000000)),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  check (currency = 'USD' or rate is not null)
);
create index payments_session_idx on public.payments (session_id);
create index payments_restaurant_status_idx on public.payments (restaurant_id, status, created_at);
create index payments_created_by_idx on public.payments (created_by);
create index payments_resolved_by_idx on public.payments (resolved_by);

-- Qué platos (y cuánto de cada uno) cubre cada pago.
create table public.payment_items (
  payment_id uuid not null references public.payments(id) on delete cascade,
  item_id uuid not null references public.order_items(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  amount_usd_cents integer not null check (amount_usd_cents > 0),
  primary key (payment_id, item_id)
);
create index payment_items_item_idx on public.payment_items (item_id);
create index payment_items_session_idx on public.payment_items (session_id);

alter table public.payments enable row level security;
alter table public.payment_items enable row level security;
revoke all on public.payments, public.payment_items from anon;
revoke insert, update, delete, truncate, references, trigger on public.payments, public.payment_items from authenticated;
-- Lo ven el personal y los comensales sentados en esa mesa (es la cuenta de todos); se escribe solo por funciones.
create policy payments_select on public.payments
  for select to authenticated
  using (private.is_member(restaurant_id) or private.is_participant(session_id));
create policy payment_items_select on public.payment_items
  for select to authenticated
  using (private.is_member(private.session_restaurant(session_id)) or private.is_participant(session_id));
alter publication supabase_realtime add table public.payments, public.payment_items;

-- Lo que falta por cubrir de cada plato (céntimos de dólar): total de la línea menos pagos pendientes o confirmados.
create function private.items_remaining(p_session_id uuid, p_item_ids uuid[])
returns table (item_id uuid, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id,
         (i.unit_price_cents * i.quantity
           - coalesce((select sum(pi.amount_usd_cents) from public.payment_items pi
                       join public.payments p on p.id = pi.payment_id
                       where pi.item_id = i.id and p.status in ('pending', 'confirmed')), 0))::integer
  from public.order_items i
  where i.session_id = p_session_id and i.status <> 'cancelled'
    and (p_item_ids is null or i.id = any(p_item_ids));
$$;
revoke execute on function private.items_remaining(uuid, uuid[]) from public, anon, authenticated;

-- Crea el pago con sus platos; devuelve su id. p_status define si nace pendiente (comensal) o confirmado (personal).
create function private.create_payment(
  p_session public.table_sessions, p_item_ids uuid[], p_method text, p_reference text, p_payer_name text,
  p_currency text, p_rate numeric, p_status text, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rest public.restaurants;
  v_total integer;
  v_id uuid;
  v_paid bigint;
begin
  select * into v_rest from public.restaurants where id = p_session.restaurant_id;
  if p_method <> all(v_rest.payment_methods) then
    raise exception 'method_not_accepted';
  end if;
  if p_item_ids is not null and (
     select count(*) from private.items_remaining(p_session.id, p_item_ids)) <> cardinality(p_item_ids) then
    raise exception 'invalid_items';
  end if;
  select coalesce(sum(r.remaining), 0) into v_total
  from private.items_remaining(p_session.id, p_item_ids) r where r.remaining > 0;
  if v_total <= 0 then
    raise exception 'already_paid';
  end if;
  if p_currency = 'VES' then
    if p_rate is null or p_rate <= 0 then
      raise exception 'rate_required';
    end if;
    v_paid := round(v_total * p_rate);
  else
    v_paid := v_total;
  end if;

  insert into public.payments (session_id, restaurant_id, payer_name, method, reference, amount_usd_cents,
                               currency, amount_paid_cents, rate, status, created_by, resolved_by, resolved_at)
  values (p_session.id, p_session.restaurant_id, left(nullif(btrim(p_payer_name), ''), 60), p_method,
          left(nullif(btrim(p_reference), ''), 60), v_total, p_currency, v_paid,
          case when p_currency = 'VES' then p_rate end, p_status, p_user,
          case when p_status = 'confirmed' then p_user end, case when p_status = 'confirmed' then now() end)
  returning id into v_id;

  insert into public.payment_items (payment_id, item_id, session_id, amount_usd_cents)
  select v_id, r.item_id, p_session.id, r.remaining
  from private.items_remaining(p_session.id, p_item_ids) r where r.remaining > 0;
  return v_id;
end;
$$;
revoke execute on function private.create_payment(public.table_sessions, uuid[], text, text, text, text, numeric, text, uuid)
  from public, anon, authenticated;

-- Comensal: avisa que va a pagar estos platos (pendiente hasta que el personal lo confirme).
create function public.request_payment(
  p_session_id uuid, p_item_ids uuid[], p_method text, p_reference text default null, p_payer_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.table_sessions;
begin
  if v_user is null then
    raise exception 'auth_required';
  end if;
  select * into v_session from public.table_sessions where id = p_session_id and status = 'open';
  if not found then
    raise exception 'invalid_session';
  end if;
  if not private.is_participant(p_session_id) then
    raise exception 'forbidden';
  end if;
  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    raise exception 'invalid_items';
  end if;
  return private.create_payment(v_session, p_item_ids, p_method, p_reference, p_payer_name, 'USD', null, 'pending', v_user);
end;
$$;

-- Personal: registra un cobro ya hecho (efectivo, punto, transferencia…). Sin lista de platos = todo lo pendiente.
create function public.staff_record_payment(
  p_session_id uuid, p_item_ids uuid[], p_method text, p_reference text default null,
  p_payer_name text default null, p_currency text default 'USD', p_rate numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
begin
  select * into v_session from public.table_sessions where id = p_session_id and status = 'open';
  if not found or not private.has_permission(v_session.restaurant_id, 'payments.manage') then
    raise exception 'forbidden';
  end if;
  return private.create_payment(v_session, p_item_ids, p_method, p_reference, p_payer_name,
                                coalesce(p_currency, 'USD'), p_rate, 'confirmed', (select auth.uid()));
end;
$$;

-- Personal: confirma o rechaza un pago pedido por un comensal. Al confirmar fija cómo se pagó de verdad.
create function public.confirm_payment(
  p_payment_id uuid, p_accept boolean, p_method text default null, p_reference text default null,
  p_currency text default 'USD', p_rate numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
  v_user uuid := (select auth.uid());
  v_method text;
  v_currency text := coalesce(p_currency, 'USD');
begin
  select * into v_pay from public.payments where id = p_payment_id and status = 'pending' for update;
  if not found then
    return;
  end if;
  if not private.has_permission(v_pay.restaurant_id, 'payments.manage') then
    raise exception 'forbidden';
  end if;
  if not p_accept then
    update public.payments set status = 'rejected', resolved_by = v_user, resolved_at = now() where id = p_payment_id;
    return;
  end if;
  v_method := coalesce(p_method, v_pay.method);
  if v_method not in ('cash', 'pago_movil', 'card_pos', 'transfer', 'zelle', 'other') then
    raise exception 'method_not_accepted';
  end if;
  if v_currency = 'VES' and (p_rate is null or p_rate <= 0) then
    raise exception 'rate_required';
  end if;
  update public.payments
  set status = 'confirmed', method = v_method,
      reference = coalesce(left(nullif(btrim(p_reference), ''), 60), reference),
      currency = v_currency,
      rate = case when v_currency = 'VES' then p_rate end,
      amount_paid_cents = case when v_currency = 'VES' then round(amount_usd_cents * p_rate) else amount_usd_cents end,
      resolved_by = v_user, resolved_at = now()
  where id = p_payment_id;
end;
$$;

-- Quien pidió el pago puede retirarlo mientras siga pendiente.
create function public.cancel_payment(p_payment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments set status = 'cancelled', resolved_at = now()
  where id = p_payment_id and status = 'pending' and created_by = (select auth.uid());
$$;

revoke execute on function public.request_payment(uuid, uuid[], text, text, text),
  public.staff_record_payment(uuid, uuid[], text, text, text, text, numeric),
  public.confirm_payment(uuid, boolean, text, text, text, numeric),
  public.cancel_payment(uuid) from public, anon;
grant execute on function public.request_payment(uuid, uuid[], text, text, text),
  public.staff_record_payment(uuid, uuid[], text, text, text, text, numeric),
  public.confirm_payment(uuid, boolean, text, text, text, numeric),
  public.cancel_payment(uuid) to authenticated;

-- Al cerrar la mesa se descartan los pagos que seguían pendientes.
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
  update public.payments set status = 'cancelled', resolved_at = now()
  where session_id = new.id and status = 'pending';
  return new;
end;
$$;

-- El comensal también necesita los métodos y las instrucciones de pago del local.
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
    'payment_methods', to_jsonb(r.payment_methods), 'payment_instructions', r.payment_instructions)
  from public.restaurants r
  where r.id = p_restaurant_id;
$$;
