-- Defensa en profundidad: las tablas nuevas heredaron los permisos por defecto de Supabase.
-- RLS ya bloquea a anon y limita a authenticated, pero TRUNCATE, TRIGGER y REFERENCES no pasan por RLS.
revoke all on public.inventory_items from anon, authenticated;
revoke all on public.inventory_movements from anon, authenticated;
grant select, delete on public.inventory_items to authenticated;
grant select on public.inventory_movements to authenticated;
