import Link from "next/link";
import { CartLink } from "./cart-link";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-tomato">
          appetito
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link href="/menu" className="text-muted hover:text-foreground">
            Menú
          </Link>
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
