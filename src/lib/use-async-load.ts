"use client";

import { useCallback, useEffect, useState } from "react";

type LoadState<T> = { data: T | null; error: string | null };

/**
 * Carga datos al montar y expone `reload`. `loader` debe ser estable
 * (envuélvelo en useCallback con sus dependencias).
 */
export function useAsyncLoad<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ data: null, error: null });

  const reload = useCallback(async () => {
    try {
      const data = await loader();
      setState({ data, error: null });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Error desconocido";
      setState((prev) => ({ data: prev.data, error }));
    }
  }, [loader]);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return { ...state, reload };
}

/** Lanza si la respuesta de Supabase trae error; si no, devuelve los datos. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
