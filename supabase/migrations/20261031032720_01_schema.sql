create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
create index restaurant_members_user_id_idx on public.restaurant_members (user_id);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 400),
  price_cents integer not null check (price_cents >= 0),
  category text not null check (char_length(category) between 1 and 40),
  emoji text not null default '🍽️',
  image_url text,
  available boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, slug)
);
create index dishes_restaurant_id_idx on public.dishes (restaurant_id);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  capacity integer not null default 4 check (capacity between 1 and 50),
  reserved_by text check (char_length(reserved_by) <= 80),
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, label)
);

create table public.seats (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dining_tables(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  position integer not null default 0,
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  unique (table_id, label)
);
create index seats_table_id_idx on public.seats (table_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid references public.dining_tables(id) on delete set null,
  table_label text not null,
  seat_id uuid references public.seats(id) on delete set null,
  seat_label text,
  diner_name text check (char_length(diner_name) <= 60),
  note text check (char_length(note) <= 300),
  status text not null default 'received'
    check (status in ('received', 'preparing', 'served', 'cancelled')),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_restaurant_created_idx on public.orders (restaurant_id, created_at desc);
create index orders_table_id_idx on public.orders (table_id);
create index orders_seat_id_idx on public.orders (seat_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  dish_id uuid references public.dishes(id) on delete set null,
  dish_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 20)
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_dish_id_idx on public.order_items (dish_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();
