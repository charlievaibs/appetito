"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { joinSession, requestService } from "@/lib/diner-api";
import { saveSession } from "@/lib/diner-session";
import { WaitingForWaiter } from "./waiting-for-waiter";
import { parseTagAction } from "@/lib/tags";

/**
 * Pantalla a la que llega el comensal al escanear un QR o acercar el móvil a una
 * etiqueta NFC (ambos abren /m/<código>). Lo sienta en la mesa, recuerda la mesa
 * en el dispositivo y lo lleva al menú. No requiere cuenta.
 */
export function CheckIn({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Las etiquetas de servicio («llamar al mesero», «pedir la cuenta») traen `?a=...`.
    const action = parseTagAction(window.location.search);
    joinSession(token)
      .then(async (result) => {
        if (cancelled) return;
        // Mesa ocupada o de un restaurante estricto: una foto del QR no basta, decide el mesero.
        if (result.status === "pending") {
          setPendingRequest(result.requestId);
          return;
        }
        const ctx = result.ctx;
        // El aviso no debe impedir entrar a la mesa: si falla, la persona puede repetirlo desde allí.
        if (action) await requestService(ctx.sessionId, action).catch(() => undefined);
        if (cancelled) return;
        saveSession({
          sessionId: ctx.sessionId,
          restaurantName: ctx.restaurant.name,
          tableLabel: ctx.table.label,
        });
        router.replace("/mesa");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "No pudimos abrir la mesa.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (pendingRequest) {
    return (
      <div className="mx-auto max-w-sm">
        <WaitingForWaiter requestId={pendingRequest} table="tu mesa" onDone={() => router.replace("/app")} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-sm text-center">
        <p className="text-5xl" aria-hidden="true">
          😕
        </p>
        <h1 className="mt-4 text-xl font-bold">No pudimos abrir tu mesa</h1>
        <p role="alert" className="mt-2 text-muted">
          {error}
        </p>
        <Link
          href="/app"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-tomato px-6 font-semibold text-white hover:bg-tomato-dark"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm text-center" role="status">
      <p className="animate-pulse text-5xl" aria-hidden="true">
        🍽️
      </p>
      <p className="mt-4 text-lg font-semibold">Entrando a tu mesa…</p>
    </div>
  );
}
