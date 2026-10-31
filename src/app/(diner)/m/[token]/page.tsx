import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckIn } from "@/components/diner/check-in";

export const metadata: Metadata = {
  title: "Entrando a tu mesa · Appetito",
  // Estas direcciones viven en etiquetas NFC y QR impresos: no deben indexarse.
  robots: { index: false, follow: false },
};

export default function CheckInPage({ params }: PageProps<"/m/[token]">) {
  return (
    <Suspense fallback={<div className="mt-16 text-center text-muted">Entrando a tu mesa…</div>}>
      <CheckInFromParams params={params} />
    </Suspense>
  );
}

/** Espera el parámetro de la ruta (el código de la etiqueta) dentro de Suspense. */
async function CheckInFromParams({ params }: Pick<PageProps<"/m/[token]">, "params">) {
  const { token } = await params;
  return <CheckIn token={token} />;
}
