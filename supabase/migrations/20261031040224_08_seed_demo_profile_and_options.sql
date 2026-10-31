-- Perfil público del restaurante demo (aparece en el directorio)
update public.restaurants
set description = 'Restaurante de demostración de Appetito: hamburguesas, pizzas y más.',
    city = 'Caracas',
    address = 'Av. Principal, Chacao',
    latitude = 10.4969,
    longitude = -66.8536,
    listed = true,
    change_policy = 'before_kitchen'
where slug = 'demo';

do $$
declare
  r uuid := (select id from public.restaurants where slug = 'demo');
  g uuid;
begin
  -- Hamburguesas: quitar ingredientes, término y extras
  for g in select id from public.dishes where restaurant_id = r and category = 'Hamburguesas' loop
    declare
      g1 uuid; g2 uuid; g3 uuid;
    begin
      insert into public.dish_option_groups (dish_id, name, kind, required, position)
      values (g, 'Quitar ingredientes', 'multiple', false, 1) returning id into g1;
      insert into public.dish_options (group_id, name, price_delta_cents, position) values
        (g1, 'Sin salsa', 0, 1), (g1, 'Sin cebolla', 0, 2), (g1, 'Sin tomate', 0, 3), (g1, 'Sin lechuga', 0, 4);

      insert into public.dish_option_groups (dish_id, name, kind, required, position)
      values (g, 'Término de la carne', 'single', false, 2) returning id into g2;
      insert into public.dish_options (group_id, name, price_delta_cents, position) values
        (g2, 'Término medio', 0, 1), (g2, 'Bien cocida', 0, 2);

      insert into public.dish_option_groups (dish_id, name, kind, required, position)
      values (g, 'Extras', 'multiple', false, 3) returning id into g3;
      insert into public.dish_options (group_id, name, price_delta_cents, position) values
        (g3, 'Queso extra', 100, 1), (g3, 'Tocino', 150, 2);
    end;
  end loop;

  -- Pizzas: extras
  for g in select id from public.dishes where restaurant_id = r and category = 'Pizzas' loop
    declare g1 uuid;
    begin
      insert into public.dish_option_groups (dish_id, name, kind, required, position)
      values (g, 'Extras', 'multiple', false, 1) returning id into g1;
      insert into public.dish_options (group_id, name, price_delta_cents, position) values
        (g1, 'Queso extra', 150, 1), (g1, 'Sin orégano', 0, 2);
    end;
  end loop;

  -- Limonada: personalizar
  for g in select id from public.dishes where restaurant_id = r and slug = 'limonada' loop
    declare g1 uuid;
    begin
      insert into public.dish_option_groups (dish_id, name, kind, required, position)
      values (g, 'Personalizar', 'multiple', false, 1) returning id into g1;
      insert into public.dish_options (group_id, name, price_delta_cents, position) values
        (g1, 'Sin hielo', 0, 1), (g1, 'Poco azúcar', 0, 2);
    end;
  end loop;
end $$;
