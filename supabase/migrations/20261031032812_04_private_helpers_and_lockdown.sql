create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_member(uuid) set schema private;
alter function public.is_owner(uuid) set schema private;

-- rls_auto_enable() solo existe si el proyecto activó "Automatically enable RLS" en Supabase.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
