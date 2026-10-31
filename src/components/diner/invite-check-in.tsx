"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { joinWithInvite } from "@/lib/diner-api";
import { saveSession } from "@/lib/diner-session";

/**
 * Pantalla a la que llega quien escanea la invitación rotativa de una mesa (/i/<token>).
 * La invitación caduca en minutos, así que solo entra quien la escanea a tiempo.
 */
export function InviteCheckIn({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    joinWithInvite(token)
      .then((ctx) => {
        if (cancelled) return;
        saveSession({ sessionId: ctx.sessionId, restaurantName: ctx.restaurant.name, tableLabel: ctx.table.label });
        router.replace("/mesa");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "No pudimos unirte a la mesa.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-sm text-center">
        <p className="text-5xl" aria-hidden="true">
          ⌛
        </p>
        <h1 className="mt-4 text-xl font-bold">No pudimos unirte a la mesa</h1>
        <p role="alert" className="mt-2 text-muted">
          {error}
        </p>
        <Link
          href="/app"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-tomato px-6 font-semibold text-white hover:bg-tomato-dark"
        >
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm text-center" role="status">
      <p className="animate-pulse text-5xl" aria-hidden="true">
        🍽️
      </p>
      <p className="mt-4 text-lg font-semibold">Uniéndote a la mesa…</p>
    </div>
  );
}
