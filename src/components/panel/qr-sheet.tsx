"use client";

import Link from "next/link";
import { useState } from "react";
import { QrImage, qrLink } from "@/components/qr-image";
import { canWriteNfc, writeNfcUrl } from "@/lib/nfc";
import { useRestaurant } from "@/lib/panel-context";
import { SERVICE_LABEL, type ServiceKind } from "@/lib/tags";
import { primaryButton, secondaryButton, smallButton } from "./styles";
import { useTables } from "./tables-manager";

/**
 * Etiquetas de las mesas: hoja imprimible con el QR de cada mesa, puesto y aviso de
 * servicio, y grabación de esas mismas direcciones en etiquetas NFC (Chrome en Android).
 * QR y NFC abren la misma dirección, así que cada restaurante usa uno, otro o ambos.
 */
export function QrSheet() {
  const restaurant = useRestaurant();
  const { data: tables, error } = useTables();
  // `canWriteNfc` depende del navegador: se decide en el cliente, tras montar.
  const nfc = typeof window !== "undefined" && canWriteNfc();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Etiquetas NFC y QR</h1>
        <div className="flex gap-2">
          <Link href="/panel/mesas" className={secondaryButton}>
            Volver
          </Link>
          <button type="button" className={primaryButton} onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted print:hidden">
        {nfc
          ? "Pulsa «Grabar NFC» en una etiqueta y acerca una etiqueta NFC en blanco a la parte trasera del móvil."
          : "Para grabar etiquetas NFC abre esta página en Chrome desde un móvil Android con NFC. Mientras tanto, imprime los QR: abren lo mismo."}{" "}
        Las etiquetas de «llamar al mesero» y «pedir la cuenta» avisan al personal sin que el comensal tenga que pedir nada más.
      </p>
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
          <Tile key={t.id} title={t.label} subtitle={restaurant.name} token={t.qr_token} nfc={nfc} />,
          ...t.seats.map((s) => (
            <Tile
              key={s.id}
              title={`${t.label} · ${s.label}`}
              subtitle={restaurant.name}
              token={s.qr_token}
              nfc={nfc}
            />
          )),
          ...(["waiter", "bill"] as ServiceKind[]).map((kind) => (
            <Tile
              key={`${t.id}-${kind}`}
              title={SERVICE_LABEL[kind]}
              subtitle={`${t.label} · ${restaurant.name}`}
              token={t.qr_token}
              action={kind}
              nfc={nfc}
            />
          )),
        ])}
      </div>
    </div>
  );
}

/** Una pieza de la hoja: el QR con el nombre de la mesa, puesto o aviso, y su botón de NFC. */
function Tile({
  title,
  subtitle,
  token,
  action,
  nfc,
}: {
  title: string;
  subtitle: string;
  token: string;
  action?: ServiceKind;
  nfc: boolean;
}) {
  const [state, setState] = useState<{ kind: "idle" | "writing" | "done" | "error"; message?: string }>({
    kind: "idle",
  });

  async function write() {
    setState({ kind: "writing" });
    try {
      await writeNfcUrl(qrLink(token, action));
      setState({ kind: "done" });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "No se pudo grabar." });
    }
  }

  return (
    <figure className="break-inside-avoid rounded-2xl border border-line bg-white p-4 text-center text-black">
      <div className="flex justify-center">
        <QrImage value={qrLink(token, action)} label={`QR de ${title}`} size={150} />
      </div>
      <figcaption className="mt-2">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </figcaption>
      {nfc && (
        <div className="mt-3 print:hidden">
          <button type="button" className={smallButton} disabled={state.kind === "writing"} onClick={() => void write()}>
            {state.kind === "writing" ? "Acerca la etiqueta…" : state.kind === "done" ? "✓ Grabada · otra vez" : "Grabar NFC"}
          </button>
          {state.kind === "error" && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {state.message}
            </p>
          )}
        </div>
      )}
    </figure>
  );
}
