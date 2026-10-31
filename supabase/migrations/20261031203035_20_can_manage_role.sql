-- Pregunta (con la sesión de quien llama) si puede crear o administrar cuentas de ese rol: dueño todos menos dueño,
-- gerente solo los de operación. La usa la función segura que crea cuentas de empleados.
create function public.can_manage_role(p_restaurant_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_role in ('manager', 'host', 'waiter', 'kitchen', 'cashier') and private.can_assign_role(p_restaurant_id, p_role);
$$;
revoke execute on function public.can_manage_role(uuid, text) from public, anon;
grant execute on function public.can_manage_role(uuid, text) to authenticated;
