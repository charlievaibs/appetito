"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { fetchSession, type SessionContext } from "@/lib/diner-api";
import { clearSavedSession, loadSavedSession } from "@/lib/diner-session";
import type { ChangeRequest, DishWithOptions, OrderItem, ServiceRequest } from "@/lib/db";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { OpenTable } from "./open-table";

type TableData =
  | { kind: "none" }
  | { kind: "closed"; restaurantName: string }
  | {
      kind: "open";
      userId: string;
      ctx: SessionContext;
      dishes: DishWithOptions[];
      items: OrderItem[];
      /** Avisos al personal que siguen pendientes. */
      requests: ServiceRequest[];
      /** Solicitudes de cambio de platos (pendientes y ya respondidas). */
      changeRequests: ChangeRequest[];
      /** Código para que los acompañantes se unan a esta mesa sin esperar al mesero. */
      joinCode: string | null;
    };

/**
 * Pantalla de la mesa del comensal. Carga la mesa guardada en el dispositivo,
 * comprueba que siga abierta y se mantiene sincronizada en vivo con lo que
 * agregan el mesero y los demás comensales.
 */
export function TableView() {
  const loader = useCallback(async (): Promise<TableData> => {
    const saved = loadSavedSession();
    if (!saved) return { kind: "none" };

    const supabase = getSupabase();
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return { kind: "none" };

    let ctx: SessionContext;
    try {
      ctx = await fetchSession(saved.sessionId);
    } catch {
      // La mesa guardada ya no existe o dejó de pertenecernos.
      clearSavedSession();
      return { kind: "none" };
    }
    if (ctx.status === "closed") {
      clearSavedSession();
      return { kind: "closed", restaurantName: ctx.restaurant.name };
    }

    const [dishes, items, requests, changeRequests, session] = await Promise.all([
      supabase
        .from("dishes")
        .select("*, dish_option_groups(*, dish_options(*))")
        .eq("restaurant_id", ctx.restaurant.id)
        .order("position")
        .order("name"),
      supabase.from("order_items").select("*").eq("session_id", ctx.sessionId).order("created_at"),
      supabase.from("service_requests").select("*").eq("session_id", ctx.sessionId).is("resolved_at", null),
      supabase.from("change_requests").select("*").eq("session_id", ctx.sessionId).order("created_at"),
      supabase.from("table_sessions").select("join_code").eq("id", ctx.sessionId).maybeSingle(),
    ]);
    return {
      kind: "open",
      userId,
      ctx,
      dishes: unwrap(dishes),
      items: unwrap(items),
      requests: unwrap(requests),
      changeRequests: unwrap(changeRequests),
      joinCode: unwrap(session)?.join_code ?? null,
    };
  }, []);

  const { data, error, reload } = useAsyncLoad(loader);
  const sessionId = data?.kind === "open" ? data.ctx.sessionId : null;

  // Tiempo real: cualquier cambio en los platos o en la mesa recarga la vista.
  useEffect(() => {
    if (!sessionId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items", filter: `session_id=eq.${sessionId}` },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests", filter: `session_id=eq.${sessionId}` },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "change_requests", filter: `session_id=eq.${sessionId}` },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "table_sessions", filter: `id=eq.${sessionId}` },
        () => void reload(),
      )
      .subscribe();
    // Respaldo por si se corta la conexión en vivo.
    const timer = setInterval(() => void reload(), 20_000);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [sessionId, reload]);

  if (error && !data) {
    return (
      <p role="alert" className="mt-10 text-center text-red-600">
        {error}
      </p>
    );
  }
  if (!data) {
    return <div className="mt-6 h-48 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }

  if (data.kind === "none") {
    return (
      <Notice
        emoji="🪑"
        title="Todavía no estás en ninguna mesa"
        text="Acerca tu móvil a la etiqueta NFC de tu mesa o escanea su QR."
      />
    );
  }
  if (data.kind === "closed") {
    return (
      <Notice
        emoji="👋"
        title="Tu mesa se cerró"
        text={`Gracias por visitar ${data.restaurantName}. ¡Esperamos verte pronto!`}
      />
    );
  }

  return <OpenTable data={data} reload={reload} />;
}

function Notice({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="mx-auto mt-16 max-w-sm text-center">
      <p className="text-5xl" aria-hidden="true">
        {emoji}
      </p>
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">{text}</p>
      <Link
        href="/app"
        className="mt-6 inline-flex h-11 items-center rounded-full bg-tomato px-6 font-semibold text-white hover:bg-tomato-dark"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
