"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Restaurant } from "./db";
import { getSupabase } from "./supabase";

type PanelState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "error"; message: string }
  | { status: "ready"; email: string; restaurants: Restaurant[] };

type PanelContextValue = {
  state: PanelState;
  restaurant: Restaurant | null;
  selectRestaurant: (id: string) => void;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const PanelContext = createContext<PanelContextValue | null>(null);

/**
 * Mantiene la sesión del personal y la lista de sus restaurantes para todo el panel.
 * Escucha los cambios de sesión de Supabase (entrar, salir, renovar) y recarga.
 * Los restaurantes los filtra la base de datos: solo llegan aquellos de los que la
 * persona es miembro.
 */
export function PanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PanelState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        setState({ status: "signed-out" });
        return;
      }
      // RLS devuelve solo los restaurantes de los que la persona es miembro.
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("created_at");
      if (error) {
        setState({ status: "error", message: error.message });
        return;
      }
      setState({
        status: "ready",
        email: session.user.email ?? "",
        restaurants: data,
      });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = getSupabase().auth.onAuthStateChange(() => {
        // Se difiere para no llamar a Supabase dentro del propio callback de auth.
        setTimeout(() => void load(), 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (e) {
      setTimeout(
        () =>
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "Error desconocido",
          }),
        0,
      );
    }
    return () => unsubscribe?.();
  }, [load]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setSelectedId(null);
  }, []);

  const value = useMemo<PanelContextValue>(() => {
    const restaurants = state.status === "ready" ? state.restaurants : [];
    const restaurant =
      restaurants.find((r) => r.id === selectedId) ?? restaurants[0] ?? null;
    return {
      state,
      restaurant,
      selectRestaurant: setSelectedId,
      reload: load,
      signOut,
    };
  }, [state, selectedId, load, signOut]);

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

export function usePanel(): PanelContextValue {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error("usePanel debe usarse dentro de PanelProvider");
  return ctx;
}

/** Restaurante activo. Solo se usa dentro del panel, ya autenticado y con restaurante. */
export function useRestaurant(): Restaurant {
  const { restaurant } = usePanel();
  if (!restaurant) throw new Error("No hay restaurante activo");
  return restaurant;
}
