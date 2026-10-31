import { Suspense } from "react";
import { JoinTeam } from "@/components/join-team";

export const instant = false;

export default function JoinWithCodePage({ params }: PageProps<"/unirse/[code]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-40 max-w-sm animate-pulse rounded-2xl bg-card" aria-hidden="true" />}>
      <JoinFromParams params={params} />
    </Suspense>
  );
}

/** Espera el parámetro de la ruta (el código del enlace) dentro de Suspense. */
async function JoinFromParams({ params }: Pick<PageProps<"/unirse/[code]">, "params">) {
  const { code } = await params;
  return <JoinTeam initialCode={code} />;
}
