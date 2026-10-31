-- Consulta el estado de una sesión de mesa sin modificarla.
-- La pueden usar los comensales sentados en ella y el personal del restaurante.
-- A diferencia de join_session, NO abre ninguna sesión: así, reabrir la app tras
-- cerrarse la mesa muestra "mesa cerrada" en lugar de sentar a la persona otra vez.
create function public.get_session(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.table_sessions;
  v_rest public.restaurants;
  v_table public.dining_tables;
begin
  select * into v_session from public.table_sessions where id = p_session_id;
  if not found
     or not (private.is_participant(p_session_id) or private.is_member(v_session.restaurant_id)) then
    raise exception 'forbidden';
  end if;

  select * into v_rest from public.restaurants where id = v_session.restaurant_id;
  select * into v_table from public.dining_tables where id = v_session.table_id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'status', v_session.status,
    'restaurant', jsonb_build_object(
      'id', v_rest.id, 'name', v_rest.name, 'slug', v_rest.slug,
      'ordering_mode', v_rest.ordering_mode, 'identification', v_rest.identification,
      'change_policy', v_rest.change_policy),
    'table', jsonb_build_object(
      'id', v_session.table_id, 'label', v_session.table_label, 'reserved_by', v_table.reserved_by),
    'participant', (
      select jsonb_build_object('seat_id', p.seat_id, 'seat_label', s.label, 'display_name', p.display_name)
      from public.session_participants p
      left join public.seats s on s.id = p.seat_id
      where p.session_id = p_session_id and p.user_id = v_user),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label) order by s.position, s.label)
      from public.seats s where s.table_id = v_session.table_id), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_session(uuid) from public, anon;
grant execute on function public.get_session(uuid) to authenticated;
