"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usePanel } from "@/lib/panel-context";
import { can, ROLE_LABEL, type Permission } from "@/lib/roles";
import { AuthForm } from "./auth-form";
import { CreateRestaurant } from "./create-restaurant";
import { smallButton } from "./styles";

/** Secciones del panel y el permiso necesario para verlas en el menú. */
const links: { href: string; label: string; permission: Permission }[] = [
  { href: "/panel", label: "Pedidos", permission: "orders.view" },
  { href: "/panel/cocina", label: "Cocina", permission: "orders.kitchen" },
  { href: "/panel/nuevo-pedido", label: "Tomar pedido", permission: "orders.take" },
  { href: "/panel/mesas", label: "Mesas", permission: "tables.edit" },
  { href: "/panel/menu", label: "Menú", permission: "menu.edit" },
  { href: "/panel/equipo", label: "Equipo", permission: "team.manage" },
  { href: "/panel/ajustes", label: "Ajustes", permission: "settings.edit" },
];

/**
 * Puerta del panel: según el estado de la sesión muestra la carga, un error, el
 * formulario de entrada, la creación del primer restaurante o el panel completo.
 */
export function PanelGate({ children }: { children: ReactNode }) {
  const { state, restaurant } = usePanel();

  if (state.status === "loading") {
    return <div className="mt-10 h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="mt-10 text-center text-red-600">
        No se pudo cargar el panel: {state.message}
      </p>
    );
  }
  if (state.status === "signed-out") return <AuthForm />;
  if (!restaurant) return <CreateRestaurant />;
  return <PanelShell>{children}</PanelShell>;
}

/** Marco del panel: restaurante activo, correo, menú de secciones y botón de salir. */
function PanelShell({ children }: { children: ReactNode }) {
  const { state, restaurant, role, selectRestaurant, signOut } = usePanel();
  const pathname = usePathname();
  const restaurants = state.status === "ready" ? state.restaurants : [];
  const email = state.status === "ready" ? state.email : "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          {restaurants.length > 1 ? (
            <select
              aria-label="Restaurante"
              value={restaurant?.id}
              onChange={(e) => selectRestaurant(e.target.value)}
              className="rounded-lg border border-line bg-card px-3 py-1.5 font-semibold"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-lg font-bold">{restaurant?.name}</p>
          )}
          <p className="text-xs text-muted">
            {email}
            {role ? ` · ${ROLE_LABEL[role]}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => void signOut()} className={smallButton}>
          Salir
        </button>
      </div>

      <nav
        className="mt-4 flex flex-wrap gap-2 border-b border-line pb-3 print:hidden"
        aria-label="Panel"
      >
        {links.filter((l) => can(role, l.permission)).map((l) => {
          const active = l.href === "/panel" ? pathname === "/panel" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-tomato text-white" : "hover:bg-line"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}
