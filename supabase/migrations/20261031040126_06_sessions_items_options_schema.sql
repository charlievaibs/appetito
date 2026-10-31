-- El modelo de pedidos pasa de "un pedido cerrado" a "platos sueltos dentro de una sesión de mesa".
-- No hay datos reales todavía, así que se reemplazan las tablas antiguas.
drop function if exists public.place_order(text, jsonb, uuid, text, text);
drop function if exists public.staff_place_order(uuid, jsonb, uuid, text, text);
drop function if exists public.get_order(uuid);
drop function if exists public.resolve_qr(text);
drop function if exists private.insert_order(uuid, uuid, jsonb, text, text);
drop table if exists public.order_items;
drop table if exists public.orders;

-- Perfil público del restaurante (para el directorio) y política de cambios
alter table public.restaurants
  add column description text not null default '' check (char_length(description) <= 300),
  add column city text check (char_length(city) <= 80),
  add column address text check (char_length(address) <= 160),
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column listed boolean not null default false,
  -- before_kitchen: se edita hasta que cocina empieza; until_ready: también mientras se prepara (se avisa a cocina)
  add column change_policy text not null default 'before_kitchen'
    check (change_policy in ('before_kitchen', 'until_ready'));

-- Una sesión es "la mesa ocupada ahora". Solo puede haber una abierta por mesa.
create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid references public.dining_tables(id) on delete set null,
  table_label text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index table_sessions_one_open_per_table
  on public.table_sessions (table_id) where status = 'open';
create index table_sessions_restaurant_status_idx
  on public.table_sessions (restaurant_id, status);

-- Quién está sentado en la sesión (comensales, normalmente invitados anónimos)
create table public.session_participants (
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_id uuid references public.seats(id) on delete set null,
  display_name text check (char_length(display_name) <= 60),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index session_participants_user_idx on public.session_participants (user_id);
create index session_participants_seat_idx on public.session_participants (seat_id);

-- Opciones de personalización por plato (quitar ingredientes, extras, término…)
create table public.dish_option_groups (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'multiple' check (kind in ('single', 'multiple')),
  required boolean not null default false,
  position integer not null default 0
);
create index dish_option_groups_dish_idx on public.dish_option_groups (dish_id);

create table public.dish_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.dish_option_groups(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  price_delta_cents integer not null default 0 check (price_delta_cents >= 0),
  available boolean not null default true,
  position integer not null default 0
);
create index dish_options_group_idx on public.dish_options (group_id);

-- Cada plato pedido es una fila con su propio estado: así se puede editar o cancelar uno
-- sin tocar el resto, y cocina ve el avance plato a plato.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  dish_id uuid references public.dishes(id) on delete set null,
  dish_name text not null,
  base_price_cents integer not null check (base_price_cents >= 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 20),
  options jsonb not null default '[]'::jsonb,
  note text check (char_length(note) <= 200),
  seat_id uuid references public.seats(id) on delete set null,
  seat_label text,
  for_name text check (char_length(for_name) <= 60),
  added_by uuid references auth.users(id) on delete set null,
  added_by_staff boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'preparing', 'ready', 'served', 'cancelled')),
  changed_after_start boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_items_session_idx on public.order_items (session_id);
create index order_items_restaurant_status_idx on public.order_items (restaurant_id, status, created_at);
create index order_items_dish_idx on public.order_items (dish_id);
create index order_items_seat_idx on public.order_items (seat_id);
create index order_items_added_by_idx on public.order_items (added_by);

create trigger order_items_set_updated_at
before update on public.order_items
for each row execute function public.set_updated_at();

alter table public.table_sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.dish_option_groups enable row level security;
alter table public.dish_options enable row level security;
alter table public.order_items enable row level security;

-- Las escrituras de sesiones, participantes y platos pedidos solo ocurren por funciones.
revoke all on public.table_sessions, public.session_participants, public.order_items from anon;
revoke insert, update, delete on public.table_sessions, public.session_participants, public.order_items from authenticated;
revoke truncate, references, trigger on public.table_sessions, public.session_participants,
  public.order_items, public.dish_option_groups, public.dish_options from authenticated;
revoke all on public.dish_option_groups, public.dish_options from anon;
grant select on public.dish_option_groups, public.dish_options to anon;

-- Ayudantes (esquema privado, no expuesto por la API)
create function private.is_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.session_participants p
    where p.session_id = p_session_id and p.user_id = (select auth.uid())
  );
$$;

create function private.session_restaurant(p_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select restaurant_id from public.table_sessions where id = p_session_id;
$$;

revoke execute on function private.is_participant(uuid), private.session_restaurant(uuid) from public, anon;
grant execute on function private.is_participant(uuid), private.session_restaurant(uuid) to authenticated;

-- Políticas
create policy sessions_select on public.table_sessions
  for select to authenticated
  using (private.is_member(restaurant_id) or private.is_participant(id));

create policy participants_select on public.session_participants
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_participant(session_id)
    or private.is_member(private.session_restaurant(session_id))
  );

create policy order_items_select on public.order_items
  for select to authenticated
  using (private.is_member(restaurant_id) or private.is_participant(session_id));

-- Opciones: visibles si el plato está disponible; el personal las gestiona
create policy option_groups_select_public on public.dish_option_groups
  for select to anon, authenticated
  using (exists (select 1 from public.dishes d where d.id = dish_id and d.available));
create policy option_groups_staff_all on public.dish_option_groups
  for all to authenticated
  using (exists (select 1 from public.dishes d where d.id = dish_id and private.is_member(d.restaurant_id)))
  with check (exists (select 1 from public.dishes d where d.id = dish_id and private.is_member(d.restaurant_id)));

create policy options_select_public on public.dish_options
  for select to anon, authenticated
  using (available and exists (
    select 1 from public.dish_option_groups g
    join public.dishes d on d.id = g.dish_id
    where g.id = group_id and d.available));
create policy options_staff_all on public.dish_options
  for all to authenticated
  using (exists (
    select 1 from public.dish_option_groups g
    join public.dishes d on d.id = g.dish_id
    where g.id = group_id and private.is_member(d.restaurant_id)))
  with check (exists (
    select 1 from public.dish_option_groups g
    join public.dishes d on d.id = g.dish_id
    where g.id = group_id and private.is_member(d.restaurant_id)));

-- Tiempo real para personal y comensales (siempre filtrado por RLS)
alter publication supabase_realtime add table public.order_items, public.table_sessions, public.session_participants;
