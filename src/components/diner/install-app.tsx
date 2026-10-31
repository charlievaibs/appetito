"use client";

import { useEffect, useState } from "react";

/** Evento no estándar de Chrome que permite mostrar el aviso de instalación cuando queramos. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "hidden" | "prompt" | "ios";

/**
 * Invita a instalar la app en el móvil, sin insistir:
 * - Android (Chrome): botón que abre el aviso de instalación del navegador.
 * - iPhone (Safari): no hay aviso programable, así que se explica el gesto.
 * - Ya instalada o sin soporte: no se muestra nada.
 */
export function InstallApp() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS no dispara `beforeinstallprompt`; se detecta por el navegador y se difiere un tick.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = isIos ? setTimeout(() => setMode("ios"), 0) : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (mode === "hidden") return null;

  if (mode === "ios") {
    return (
      <p className="mt-4 rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">
        📲 Para tenerla como app: toca <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        if (!event) return;
        await event.prompt();
        await event.userChoice;
        setEvent(null);
        setMode("hidden");
      }}
      className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-line bg-card font-semibold hover:bg-line"
    >
      📲 Instalar Appetito
    </button>
  );
}
