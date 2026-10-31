"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { tagUrl, type ServiceKind } from "@/lib/tags";

/** Dirección que abre un comensal al escanear el QR (o tocar la etiqueta NFC) de una mesa o un puesto. */
export function qrLink(token: string, action?: ServiceKind): string {
  return tagUrl(window.location.origin, token, action);
}

/** Dibuja un código QR. Se genera en el propio navegador, sin enviar la dirección a ningún servicio. */
export function QrImage({
  value,
  size = 160,
  label,
}: {
  value: string;
  size?: number;
  label: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse rounded-lg bg-line"
        aria-hidden="true"
      />
    );
  }
  return (
    <Image
      src={src}
      alt={label}
      width={size}
      height={size}
      unoptimized
      className="rounded-lg bg-white"
    />
  );
}
