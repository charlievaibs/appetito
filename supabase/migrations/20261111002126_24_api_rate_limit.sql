-- Límite de uso de la API: 120 peticiones por minuto y por llave. El contador vive en la propia llave.
alter table public.api_keys
  add column if not exists window_start timestamptz,
  add column if not exists window_count integer not null default 0;

create or replace function private.api_auth(p_key text, p_write boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.api_keys;
  v_count integer;
begin
  select * into v_row from public.api_keys
  where key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex') and revoked_at is null;
  if not found then raise exception 'invalid_api_key'; end if;
  if p_write and not v_row.can_write then raise exception 'api_key_read_only'; end if;

  -- Ventana de un minuto: si ya pasó, se reinicia; si no, se suma una petición.
  update public.api_keys set
    window_start = case when window_start is null or window_start < now() - interval '1 minute' then now() else window_start end,
    window_count = case when window_start is null or window_start < now() - interval '1 minute' then 1 else window_count + 1 end,
    last_used_at = case when last_used_at is null or last_used_at < now() - interval '1 minute' then now() else last_used_at end
  where id = v_row.id
  returning window_count into v_count;
  if v_count > 120 then raise exception 'rate_limited'; end if;

  return v_row.restaurant_id;
end;
$$;
