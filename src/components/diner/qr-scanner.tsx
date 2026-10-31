"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { parseTagLink } from "@/lib/tags";

/**
 * Escáner de QR con la cámara trasera. Pide el permiso de cámara solo al abrirse
 * (tras pulsar «Escanear») y lo suelta al cerrarse. Llama a `onFound` con el código
 * de la etiqueta cuando lee un QR de Appetito; cualquier otro QR se ignora.
 */
export function QrScanner({
  onFound,
  onClose,
}: {
  onFound: (tag: { token: string; action: "waiter" | "bill" | null }) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [foreign, setForeign] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    function scan() {
      const video = videoRef.current;
      if (stopped || !video || !context) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
        if (code) {
          const tag = parseTagLink(code.data);
          if (tag) {
            stopped = true;
            onFound(tag);
            return;
          }
          setForeign(true);
        }
      }
      frame = requestAnimationFrame(scan);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara. Usa la cámara del móvil para escanear el QR.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          frame = requestAnimationFrame(scan);
        }
      } catch (e) {
        const denied = e instanceof Error && e.name === "NotAllowedError";
        setError(
          denied
            ? "No diste permiso para usar la cámara. Puedes activarlo en los ajustes o usar la cámara del móvil."
            : "No pudimos abrir la cámara.",
        );
      }
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onFound]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escanear QR"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-semibold">Escanea el QR de tu mesa</p>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-full border border-white/30 px-4 text-sm font-medium"
        >
          Cerrar
        </button>
      </div>
      <div className="relative flex-1">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-3xl border-4 border-white/80"
        />
      </div>
      <div className="px-4 py-4 text-center text-sm" role="status">
        {error ? (
          <p role="alert" className="text-red-300">
            {error}
          </p>
        ) : foreign ? (
          <p>Ese QR no es de Appetito. Busca el de tu mesa o tu puesto.</p>
        ) : (
          <p className="text-white/80">Apunta la cámara al QR. También puedes acercar el móvil a la etiqueta NFC.</p>
        )}
      </div>
    </div>
  );
}
