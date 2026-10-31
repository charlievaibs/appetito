"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cancelJoinRequest, fetchSession } from "@/lib/diner-api";
import { saveSession } from "@/lib/diner-session";
import { getSupabase } from "@/lib/supabase";

/**
 * Pantalla de espera mientras el mesero decide. Se actualiza en vivo y también consulta de
 * vez en cuando por si falla la conexión; al aceptar, entra solo a la mesa.
 */
export function WaitingForWaiter({ requestId, table, onDone }: { requestId: string; table: string; onDone: () => void }) {
  const router = useRouter();
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();

    async function check() {
      const { data } = await supabase
        .from("join_requests")
        .select("status, session_id")
        .eq("id", requestId)
        .maybeSingle();
      if (!active || !data) return;
      if (data.status === "approved" && data.session_id) {
        try {
          saveAndEnter(await fetchSession(data.session_id), router.replace);
        } catch {
          // Si aún no se puede leer la mesa, el próximo intento lo resuelve.
        }
      } else if (data.status === "rejected" || data.status === "cancelled") {
        setRejected(true);
      }
    }

    const channel = supabase
      .channel(`join-${requestId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "join_requests", filter: `id=eq.${requestId}` }, () => void check())
      .subscribe();
    const timer = setInterval(() => void check(), 4000);
    return () => {
      active = false;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [requestId, router]);

  async function cancel() {
    await cancelJoinRequest(requestId).catch(() => undefined);
    onDone();
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-card p-5 text-center" role="status">
      {rejected ? (
        <>
          <p className="text-4xl" aria-hidden="true">
            🙋
          </p>
          <h2 className="mt-2 font-semibold">El mesero no pudo darte acceso a {table}</h2>
          <p className="mt-1 text-sm text-muted">Habla con él o prueba con el código de la reserva.</p>
        </>
      ) : (
        <>
          <p className="animate-pulse text-4xl" aria-hidden="true">
            ⏳
          </p>
          <h2 className="mt-2 font-semibold">Esperando a tu mesero</h2>
          <p className="mt-1 text-sm text-muted">Le avisamos que quieres sentarte en {table}. Entrarás en cuanto te dé acceso.</p>
        </>
      )}
      <button
        type="button"
        onClick={() => void (rejected ? Promise.resolve(onDone()) : cancel())}
        className="mt-4 h-10 rounded-full border border-line px-5 text-sm font-medium hover:bg-line"
      >
        {rejected ? "Volver" : "Cancelar"}
      </button>
    </section>
  );
}

/** Guarda la mesa en el dispositivo y lleva al comensal a ella. */
function saveAndEnter(ctx: { sessionId: string; restaurant: { name: string }; table: { label: string } }, replace: (href: string) => void) {
  saveSession({ sessionId: ctx.sessionId, restaurantName: ctx.restaurant.name, tableLabel: ctx.table.label });
  replace("/mesa");
}
