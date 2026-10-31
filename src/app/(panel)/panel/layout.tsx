import type { Metadata } from "next";
import Link from "next/link";
import { PanelGate } from "@/components/panel/panel-shell";
import { PanelProvider } from "@/lib/panel-context";

export const metadata: Metadata = {
  title: "Panel · Appetito",
  robots: { index: false, follow: false },
};
export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <>
      <header className="border-b border-line print:hidden">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-tomato">
            appetito
          </Link>
          <span className="text-sm font-medium text-muted">Panel del restaurante</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        <PanelProvider>
          <PanelGate>{children}</PanelGate>
        </PanelProvider>
      </main>
    </>
  );
}
