"use client";

import { useEffect, useState } from "react";
import { QrImage } from "@/components/qr-image";
import { createSessionInvite } from "@/lib/diner-api";
import { inviteUrl } from "@/lib/tags";

/** Cada cuánto se pide un token nuevo; el servidor lo mantiene vigente más tiempo para que ninguno caduque a mitad de un escaneo. */
const REFRESH_MS = 90_000;

/**
 * QR de invitación a una mesa. Cambia solo cada pocos minutos: una foto o una captura
 * deja de servir enseguida, así que solo entra quien está delante de la pantalla.
 * Lo usan el mesero (en su tablet) y cualquier comensal ya sentado (para sus acompañantes).
 */
export function InviteQr({ sessionId, size = 220 }: { sessionId: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const invite = await createSessionInvite(sessionId);
        if (!active) return;
        setUrl(inviteUrl(window.location.origin, invite.token));
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "No se pudo crear la invitación.");
      }
    }

    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      active = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [sessionId]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {error}
      </p>
    );
  }
  if (!url) {
    return <div style={{ width: size, height: size }} className="animate-pulse rounded-lg bg-line" aria-hidden="true" />;
  }
  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div className="rounded-2xl bg-white p-3">
        <QrImage value={url} label="QR para unirse a la mesa" size={size} />
      </div>
      <p className="text-xs text-muted">Se renueva solo: no sirve una foto.</p>
    </div>
  );
}
