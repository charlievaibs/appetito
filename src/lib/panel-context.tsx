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
import { can, parseRole, type Permission, type Role } from "./roles";
import { getSupabase } from "./supabase";

type PanelState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      email: string;
      restaurants: Restaurant[];
      /** Rol de la persona en cada restaurante (por id de restaurante). */
      roles: Record<string, Role>;
    };

type PanelContextValue = {
  state: PanelState;
  restaurant: Restaurant | null;
  /** Rol de la persona en el restaurante activo. */
  role: Role | null;
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
      // Si alguien invitó a este correo (ya confirmado), se acepta la invitación antes de cargar.
      await supabase.rpc("accept_invites");

      // RLS devuelve solo los restaurantes de los que la persona es miembro.
      const [restaurants, memberships] = await Promise.all([
        supabase.from("restaurants").select("*").order("created_at"),
        supabase.from("restaurant_members").select("restaurant_id, role").eq("user_id", session.user.id),
      ]);
      if (restaurants.error || memberships.error) {
        setState({
          status: "error",
          message: (restaurants.error ?? memberships.error)?.message ?? "Error desconocido",
        });
        return;
      }
      const roles: Record<string, Role> = {};
      for (const m of memberships.data) {
        const role = parseRole(m.role);
        if (role) roles[m.restaurant_id] = role;
      }
      setState({
        status: "ready",
        email: session.user.email ?? "",
        restaurants: restaurants.data,
        roles,
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
      role: restaurant && state.status === "ready" ? (state.roles[restaurant.id] ?? null) : null,
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

/** ¿Puede la persona hacer esto en el restaurante activo? (solo para mostrar u ocultar opciones) */
export function useCan(permission: Permission): boolean {
  return can(usePanel().role, permission);
}

/** Restaurante activo. Solo se usa dentro del panel, ya autenticado y con restaurante. */
export function useRestaurant(): Restaurant {
  const { restaurant } = usePanel();
  if (!restaurant) throw new Error("No hay restaurante activo");
  return restaurant;
}
