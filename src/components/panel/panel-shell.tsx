"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usePanel } from "@/lib/panel-context";
import { AuthForm } from "./auth-form";
import { CreateRestaurant } from "./create-restaurant";
import { smallButton } from "./styles";

const links = [
  { href: "/panel", label: "Pedidos" },
  { href: "/panel/nuevo-pedido", label: "Tomar pedido" },
  { href: "/panel/mesas", label: "Mesas" },
  { href: "/panel/menu", label: "Menú" },
  { href: "/panel/ajustes", label: "Ajustes" },
];

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

function PanelShell({ children }: { children: ReactNode }) {
  const { state, restaurant, selectRestaurant, signOut } = usePanel();
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
          <p className="text-xs text-muted">{email}</p>
        </div>
        <button type="button" onClick={() => void signOut()} className={smallButton}>
          Salir
        </button>
      </div>

      <nav
        className="mt-4 flex flex-wrap gap-2 border-b border-line pb-3 print:hidden"
        aria-label="Panel"
      >
        {links.map((l) => {
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
