import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unirme al equipo · Appetito",
  robots: { index: false, follow: false },
};

/** Marco de la pantalla para unirse al equipo de un restaurante. */
export default function JoinLayout({ children }: LayoutProps<"/unirse">) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-tomato">
            appetito
          </Link>
          <span className="text-sm font-medium text-muted">Equipo</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">{children}</main>
    </>
  );
}
