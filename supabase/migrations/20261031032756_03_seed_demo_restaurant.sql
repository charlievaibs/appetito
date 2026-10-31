do $$
declare
  r uuid;
  t uuid;
  i integer;
  n integer;
begin
  insert into public.restaurants (name, slug) values ('Appetito Demo', 'demo')
  returning id into r;

  insert into public.dishes (restaurant_id, slug, name, description, price_cents, category, emoji, position) values
    (r, 'hamburguesa-clasica', 'Hamburguesa Clásica', 'Carne 100% res, lechuga, tomate, cebolla y nuestra salsa especial.', 1299, 'Hamburguesas', '🍔', 1),
    (r, 'hamburguesa-bbq', 'Hamburguesa BBQ', 'Doble carne, queso cheddar, tocino crujiente y salsa BBQ ahumada.', 1450, 'Hamburguesas', '🍔', 2),
    (r, 'pizza-margherita', 'Pizza Margherita', 'Salsa de tomate, mozzarella fresca y albahaca.', 1550, 'Pizzas', '🍕', 3),
    (r, 'pizza-pepperoni', 'Pizza Pepperoni', 'Mozzarella, abundante pepperoni y un toque de orégano.', 1699, 'Pizzas', '🍕', 4),
    (r, 'tacos-al-pastor', 'Tacos al Pastor', 'Tres tacos con carne al pastor, piña, cebolla y cilantro.', 899, 'Mexicana', '🌮', 5),
    (r, 'burrito-de-pollo', 'Burrito de Pollo', 'Pollo a la parrilla, arroz, frijoles, queso y pico de gallo.', 1050, 'Mexicana', '🌯', 6),
    (r, 'sushi-roll', 'Sushi Roll', 'Ocho piezas de roll con salmón, aguacate y pepino.', 1875, 'Japonesa', '🍣', 7),
    (r, 'ramen', 'Ramen', 'Caldo de cerdo, fideos frescos, huevo marinado y cebollín.', 1425, 'Japonesa', '🍜', 8),
    (r, 'pasta-carbonara', 'Pasta Carbonara', 'Salsa carbonara cremosa, tocino y queso parmesano.', 1325, 'Italiana', '🍝', 9),
    (r, 'ensalada-cesar', 'Ensalada César', 'Lechuga romana, crutones, queso parmesano y aderezo césar.', 999, 'Ensaladas', '🥗', 10),
    (r, 'brownie', 'Brownie con Helado', 'Brownie tibio de chocolate con una bola de helado de vainilla.', 650, 'Postres', '🍫', 11),
    (r, 'limonada', 'Limonada Natural', 'Limones recién exprimidos, hielo y un toque de hierbabuena.', 450, 'Bebidas', '🍋', 12);

  for i in 1..4 loop
    insert into public.dining_tables (restaurant_id, label, capacity)
    values (r, 'Mesa ' || i, 4)
    returning id into t;
    for n in 1..4 loop
      insert into public.seats (table_id, label, position) values (t, 'Puesto ' || n, n);
    end loop;
  end loop;

  update public.dining_tables set reserved_by = 'Reserva de Juan'
  where restaurant_id = r and label = 'Mesa 2';
end $$;
