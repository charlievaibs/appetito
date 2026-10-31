"use client";

import Link from "next/link";
import { QrImage, qrLink } from "@/components/qr-image";
import { useRestaurant } from "@/lib/panel-context";
import { primaryButton, secondaryButton } from "./styles";
import { useTables } from "./tables-manager";

/**
 * Hoja imprimible con el QR de cada mesa y de cada puesto. Los códigos son los mismos
 * que se pueden grabar en etiquetas NFC: ambos abren la misma dirección.
 */
export function QrSheet() {
  const restaurant = useRestaurant();
  const { data: tables, error } = useTables();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">QR para imprimir</h1>
        <div className="flex gap-2">
          <Link href="/panel/mesas" className={secondaryButton}>
            Volver
          </Link>
          <button type="button" className={primaryButton} onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {tables?.length === 0 && (
        <p className="py-10 text-center text-muted print:hidden">Aún no hay mesas.</p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {tables?.flatMap((t) => [
          <Tile key={t.id} title={t.label} subtitle={restaurant.name} token={t.qr_token} />,
          ...t.seats.map((s) => (
            <Tile
              key={s.id}
              title={`${t.label} · ${s.label}`}
              subtitle={restaurant.name}
              token={s.qr_token}
            />
          )),
        ])}
      </div>
    </div>
  );
}

/** Una pieza de la hoja: el QR con el nombre de la mesa o del puesto. */
function Tile({ title, subtitle, token }: { title: string; subtitle: string; token: string }) {
  return (
    <figure className="break-inside-avoid rounded-2xl border border-line bg-white p-4 text-center text-black">
      <div className="flex justify-center">
        <QrImage value={qrLink(token)} label={`QR de ${title}`} size={150} />
      </div>
      <figcaption className="mt-2">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </figcaption>
    </figure>
  );
}
