import Link from "next/link";
import { RELEASE, SIGNING_CERT_SHA256 } from "@/lib/release";

const features = [
  {
    title: "Menú claro",
    text: "Platos con foto, categorías y búsqueda para encontrar lo que se te antoja en segundos.",
  },
  {
    title: "Pedido en un toque",
    text: "Arma tu carrito, ajusta cantidades y confirma sin pantallas de más.",
  },
  {
    title: "Siempre contigo",
    text: "Úsalo desde el navegador o instálalo en tu Android. Tu carrito no se pierde.",
  },
];

const steps = [
  { n: "1", title: "Elige", text: "Explora el menú y abre el detalle de cada plato." },
  { n: "2", title: "Arma tu pedido", text: "Agrega al carrito y ajusta las cantidades." },
  { n: "3", title: "Disfruta", text: "Confirma el pedido y listo." },
];

export default function Home() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <a href="#" className="text-xl font-bold tracking-tight text-tomato">
          appetito
        </a>
        <nav className="flex gap-6 text-sm font-medium text-muted">
          <a href="#funciones" className="hover:text-foreground">
            Funciones
          </a>
          <a href="#como-funciona" className="hover:text-foreground">
            Cómo funciona
          </a>
          <a href="#descargar" className="hover:text-foreground">
            Descargar
          </a>
          <Link href="/app" className="font-semibold text-tomato">
            Abrir app
          </Link>
          <Link href="/panel" className="hover:text-foreground">
            Soy un restaurante
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <p className="mb-4 inline-block rounded-full bg-tomato/10 px-3 py-1 text-sm font-medium text-tomato">
            Pide lo que se te antoja
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Tu menú favorito,
            <br />
            <span className="text-tomato">a un toque de distancia.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Appetito es la forma más simple de explorar el menú y armar tu
            pedido. Gratis, rápida y sin complicaciones.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center rounded-full bg-tomato px-6 font-semibold text-white transition-colors hover:bg-tomato-dark"
            >
              Abrir Appetito
            </Link>
            <DownloadButton />
          </div>
        </section>

        <section
          id="funciones"
          className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-16"
        >
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Hecho para pedir sin vueltas
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-line bg-card p-6"
              >
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="como-funciona"
          className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-16"
        >
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Cómo funciona
          </h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tomato text-lg font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="descargar"
          className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-16"
        >
          <div className="rounded-3xl bg-tomato px-6 py-14 text-center text-white">
            <h2 className="text-3xl font-bold tracking-tight">
              Llévalo en tu bolsillo
            </h2>
            <p className="mx-auto mt-3 max-w-md text-white/85">
              Instálala desde el navegador: sin tienda de apps, sin descargas raras y se actualiza sola.
            </p>
            <div className="mx-auto mt-8 grid max-w-2xl gap-4 text-left sm:grid-cols-2">
              <InstallStep title="En Android (Chrome)">
                Abre Appetito y toca <strong>Instalar Appetito</strong>, o el menú ⋮ y <strong>Instalar app</strong>.
              </InstallStep>
              <InstallStep title="En iPhone (Safari)">
                Abre Appetito, toca <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.
              </InstallStep>
            </div>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/app"
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 font-semibold text-tomato transition-colors hover:bg-white/90"
              >
                Abrir Appetito
              </Link>
              <DownloadButton inverted />
            </div>
            <ApkVerification />
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-center text-sm text-muted">
        © 2026 Appetito
      </footer>
    </>
  );
}

function DownloadButton({ inverted = false }: { inverted?: boolean }) {
  const base =
    "inline-flex h-12 items-center justify-center rounded-full px-6 font-semibold transition-colors";

  if (!RELEASE) return null;

  return (
    <a
      // Siempre la ruta propia: allí el archivo se verifica antes de entregarse.
      href="/descargar"
      className={`${base} ${
        inverted
          ? "bg-white text-tomato hover:bg-white/90"
          : "bg-tomato text-white hover:bg-tomato-dark"
      }`}
    >
      Descargar APK para Android
    </a>
  );
}

function InstallStep({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/15 p-4 text-sm text-white/95">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1">{children}</p>
    </div>
  );
}

/** Cómo comprobar que el archivo descargado es el oficial (huella SHA-256 y firma). */
function ApkVerification() {
  if (!RELEASE) return null;
  return (
    <details className="mx-auto mt-6 max-w-xl text-left text-sm text-white/90">
      <summary className="cursor-pointer text-center font-medium">
        Versión {RELEASE.version} · cómo comprobar que es el archivo oficial
      </summary>
      <p className="mt-3">
        Descárgalo solo desde esta página. Si quieres verificarlo, la huella SHA-256 del archivo debe ser:
      </p>
      <code className="mt-2 block break-all rounded-xl bg-black/25 p-3 text-xs">{RELEASE.sha256}</code>
      <p className="mt-2 text-white/80">
        En Windows: <code>certutil -hashfile appetito-{RELEASE.version}.apk SHA256</code>. En Linux o Mac:{" "}
        <code>sha256sum appetito-{RELEASE.version}.apk</code>.
      </p>
      {SIGNING_CERT_SHA256 && (
        <>
          <p className="mt-3">La app oficial siempre está firmada con el certificado cuya huella SHA-256 es:</p>
          <code className="mt-2 block break-all rounded-xl bg-black/25 p-3 text-xs">{SIGNING_CERT_SHA256}</code>
        </>
      )}
    </details>
  );
}
