import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteCheckIn } from "@/components/diner/invite-check-in";

export const metadata: Metadata = {
  title: "Uniéndote a la mesa · Appetito",
  // Son invitaciones temporales: no deben indexarse ni guardarse en buscadores.
  robots: { index: false, follow: false },
};

export default function InvitePage({ params }: PageProps<"/i/[token]">) {
  return (
    <Suspense fallback={<div className="mt-16 text-center text-muted">Uniéndote a la mesa…</div>}>
      <InviteFromParams params={params} />
    </Suspense>
  );
}

/** Espera el parámetro de la ruta (el token de la invitación) dentro de Suspense. */
async function InviteFromParams({ params }: Pick<PageProps<"/i/[token]">, "params">) {
  const { token } = await params;
  return <InviteCheckIn token={token} />;
}
