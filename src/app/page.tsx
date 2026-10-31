import Link from "next/link";

const APK_URL = process.env.NEXT_PUBLIC_APK_URL;

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
          <Link href="/menu" className="font-semibold text-tomato">
            Abrir app
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
            <DownloadButton />
            <Link
              href="/menu"
              className="inline-flex h-12 items-center justify-center rounded-full border border-line px-6 font-medium transition-colors hover:bg-card"
            >
              Abrir en el navegador
            </Link>
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
              Descarga Appetito para Android o instálalo desde el navegador.
            </p>
            <div className="mt-8 flex justify-center">
              <DownloadButton inverted />
            </div>
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

  if (!APK_URL) {
    return (
      <span
        aria-disabled="true"
        className={`${base} cursor-not-allowed ${
          inverted ? "bg-white/20 text-white/80" : "bg-line text-muted"
        }`}
      >
        Descarga para Android: próximamente
      </span>
    );
  }

  return (
    <a
      href={APK_URL}
      className={`${base} ${
        inverted
          ? "bg-white text-tomato hover:bg-white/90"
          : "bg-tomato text-white hover:bg-tomato-dark"
      }`}
    >
      Descargar para Android
    </a>
  );
}
