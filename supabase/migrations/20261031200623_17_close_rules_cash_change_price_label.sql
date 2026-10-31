-- ===== Cierre de mesa, vuelto en efectivo, etiqueta REF y precios del menú =====

alter table public.restaurants
  -- Cómo se marcan los precios: REF (divisa referenciada, lo habitual en Venezuela), dólar ($) o euro (€).
  add column price_label text not null default 'ref' check (price_label in ('ref', 'usd', 'eur')),
  -- Si los precios se ven en el menú o solo en la cuenta al cobrar.
  add column menu_prices_visible boolean not null default true,
  -- Quién cierra las mesas: solo caja/gerente/dueño (cashier) o también anfitrión y mesero (staff, para locales pequeños).
  add column table_close text not null default 'cashier' check (table_close in ('cashier', 'staff'));

alter table public.table_sessions add column closed_unpaid_cents integer not null default 0;

alter table public.payments
  add column cash_received_cents bigint check (cash_received_cents is null or cash_received_cents > 0),
  add column change_given_cents bigint check (change_given_cents is null or change_given_cents >= 0);

-- Cerrar una mesa pasa a depender del local: caja/gerente/dueño siempre; anfitrión y mesero solo si el local lo permite.
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
        when 'session.close'   then m.role in ('owner', 'manager', 'cashier')
                                    or (m.role in ('host', 'waiter') and exists (
                                          select 1 from public.restaurants r
                                          where r.id = p_restaurant_id and r.table_close = 'staff'))
        when 'payments.manage' then m.role in ('owner', 'manager', 'host', 'waiter', 'cashier')
        when 'orders.view'     then true
        else false
      end
  );
$$;

-- Cerrar la mesa exige que esté saldada. Solo caja, gerente o dueño pueden cerrarla con deuda (p_force), y queda anotado.
drop function public.close_session(uuid);
create function public.close_session(p_session_id uuid, p_force boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.table_sessions;
  v_remaining integer;
  v_pending integer;
  v_role text;
begin
  select * into v_session from public.table_sessions where id = p_session_id and status = 'open';
  if not found or not private.has_permission(v_session.restaurant_id, 'session.close') then
    raise exception 'forbidden';
  end if;

  select coalesce(sum(r.remaining), 0) into v_remaining
  from private.items_remaining(p_session_id, null) r where r.remaining > 0;
  select coalesce(sum(amount_usd_cents), 0) into v_pending
  from public.payments where session_id = p_session_id and status = 'pending';

  if v_pending > 0 and not p_force then
    raise exception 'payments_pending';
  end if;
  if v_remaining > 0 and not p_force then
    raise exception 'unpaid_balance';
  end if;
  if p_force and (v_remaining > 0 or v_pending > 0) then
    select role into v_role from public.restaurant_members
    where restaurant_id = v_session.restaurant_id and user_id = (select auth.uid());
    if v_role is null or v_role not in ('owner', 'manager', 'cashier') then
      raise exception 'forbidden';
    end if;
  end if;

  update public.table_sessions
  set status = 'closed', closed_at = now(), closed_unpaid_cents = v_remaining + v_pending
  where id = p_session_id;
end;
$$;
revoke execute on function public.close_session(uuid, boolean) from public, anon;
grant execute on function public.close_session(uuid, boolean) to authenticated;

-- Pago en efectivo: se anota cuánto entregó el cliente y el vuelto, para cuadrar la caja.
drop function private.create_payment(public.table_sessions, uuid[], text, text, text, text, numeric, text, uuid);
create function private.create_payment(
  p_session public.table_sessions, p_item_ids uuid[], p_method text, p_reference text, p_payer_name text,
  p_currency text, p_rate numeric, p_status text, p_user uuid, p_received bigint default null)
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
  if p_method = 'cash' and p_received is not null and p_received < v_paid then
    raise exception 'insufficient_cash';
  end if;

  insert into public.payments (session_id, restaurant_id, payer_name, method, reference, amount_usd_cents,
                               currency, amount_paid_cents, rate, status, created_by, resolved_by, resolved_at,
                               cash_received_cents, change_given_cents)
  values (p_session.id, p_session.restaurant_id, left(nullif(btrim(p_payer_name), ''), 60), p_method,
          left(nullif(btrim(p_reference), ''), 60), v_total, p_currency, v_paid,
          case when p_currency = 'VES' then p_rate end, p_status, p_user,
          case when p_status = 'confirmed' then p_user end, case when p_status = 'confirmed' then now() end,
          case when p_method = 'cash' then p_received end,
          case when p_method = 'cash' and p_received is not null then p_received - v_paid end)
  returning id into v_id;

  insert into public.payment_items (payment_id, item_id, session_id, amount_usd_cents)
  select v_id, r.item_id, p_session.id, r.remaining
  from private.items_remaining(p_session.id, p_item_ids) r where r.remaining > 0;
  return v_id;
end;
$$;
revoke execute on function private.create_payment(public.table_sessions, uuid[], text, text, text, text, numeric, text, uuid, bigint)
  from public, anon, authenticated;

drop function public.staff_record_payment(uuid, uuid[], text, text, text, text, numeric);
create function public.staff_record_payment(
  p_session_id uuid, p_item_ids uuid[], p_method text, p_reference text default null,
  p_payer_name text default null, p_currency text default 'USD', p_rate numeric default null,
  p_received bigint default null)
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
                                coalesce(p_currency, 'USD'), p_rate, 'confirmed', (select auth.uid()), p_received);
end;
$$;

drop function public.confirm_payment(uuid, boolean, text, text, text, numeric);
create function public.confirm_payment(
  p_payment_id uuid, p_accept boolean, p_method text default null, p_reference text default null,
  p_currency text default 'USD', p_rate numeric default null, p_received bigint default null)
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
  v_paid bigint;
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
  v_paid := case when v_currency = 'VES' then round(v_pay.amount_usd_cents * p_rate) else v_pay.amount_usd_cents end;
  if v_method = 'cash' and p_received is not null and p_received < v_paid then
    raise exception 'insufficient_cash';
  end if;
  update public.payments
  set status = 'confirmed', method = v_method,
      reference = coalesce(left(nullif(btrim(p_reference), ''), 60), reference),
      currency = v_currency,
      rate = case when v_currency = 'VES' then p_rate end,
      amount_paid_cents = v_paid,
      cash_received_cents = case when v_method = 'cash' then p_received end,
      change_given_cents = case when v_method = 'cash' and p_received is not null then p_received - v_paid end,
      resolved_by = v_user, resolved_at = now()
  where id = p_payment_id;
end;
$$;

revoke execute on function public.staff_record_payment(uuid, uuid[], text, text, text, text, numeric, bigint),
  public.confirm_payment(uuid, boolean, text, text, text, numeric, bigint) from public, anon;
grant execute on function public.staff_record_payment(uuid, uuid[], text, text, text, text, numeric, bigint),
  public.confirm_payment(uuid, boolean, text, text, text, numeric, bigint) to authenticated;

-- El comensal necesita saber cómo mostrar los precios (etiqueta y si van en el menú).
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
    'payment_methods', to_jsonb(r.payment_methods), 'payment_instructions', r.payment_instructions)
  from public.restaurants r
  where r.id = p_restaurant_id;
$$;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.list_restaurants(double precision, double precision, integer)'::regprocedure) into v_def;
  if position('''price_display'', x.price_display,' in v_def) = 0 then
    raise exception 'patrón no encontrado en list_restaurants';
  end if;
  execute replace(v_def, '''price_display'', x.price_display,',
    '''price_display'', x.price_display, ''price_label'', x.price_label, ''menu_prices_visible'', x.menu_prices_visible,');
end $$;
