"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Dirección que abre un comensal al escanear el QR de una mesa o un puesto. */
export function qrLink(token: string): string {
  return `${window.location.origin}/m/${token}`;
}

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
