import Link from "next/link";

/** Marco común de las pantallas del comensal: cabecera con el logo y contenido centrado. */
export default function DinerLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-4">
          <Link href="/app" className="text-xl font-bold tracking-tight text-tomato">
            appetito
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">{children}</main>
    </>
  );
}
