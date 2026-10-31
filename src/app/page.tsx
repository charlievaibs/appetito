import Link from "next/link";
import { RELEASE, SIGNING_CERT_SHA256 } from "@/lib/release";

/** Qué obtiene quien come. */
const dinerFeatures = [
  { icon: "📲", title: "Entras sin cuenta", text: "Acercas el móvil a la etiqueta NFC, escaneas el QR o eliges tu mesa y tu asiento en la app. Sin registrarte ni descargar nada." },
  { icon: "🍔", title: "Pides y ajustas tu plato", text: "«Sin salsa», «extra de queso», término de la carne… Puedes cambiarlo hasta que cocina empiece, sin llamar a nadie." },
  { icon: "🧾", title: "Tienes tu historial", text: "Ves lo que pediste tú y lo que pidió la mesa, con su estado en vivo: esperando, en preparación, listo, servido." },
  { icon: "💳", title: "Pagas como quieras", text: "Cada quien paga lo suyo, uno paga toda la mesa o se reparte por platos. Ves el total en dólares y en bolívares a la tasa del BCV." },
  { icon: "🔔", title: "Avisas sin levantar la mano", text: "«Llamar al mesero» y «Pedir la cuenta» con un toque. El mesero lo ve al instante y lo marca como atendido." },
  { icon: "👥", title: "Invitas a tu mesa", text: "Muestras un QR que se renueva solo y tus acompañantes se unen. Una foto del QR de la mesa no sirve para colarse." },
  { icon: "📍", title: "Encuentras restaurantes", text: "Un directorio con los más cercanos (solo si das tu ubicación) y el menú de cada uno antes de sentarte." },
];

/** Qué obtiene el restaurante. */
const restaurantFeatures = [
  { icon: "🧑‍🍳", title: "Un equipo con roles reales", text: "Dueño, gerente, anfitrión, mesero, cocina y caja. Cada uno ve y puede hacer solo lo suyo, desde un local de una persona hasta uno grande." },
  { icon: "🪑", title: "Salón con las mesas en pantalla", text: "Estado de cada mesa de un vistazo, avisos de los comensales, «Abrir mesa» con un QR que cambia solo, dar acceso y cerrar." },
  { icon: "📋", title: "Pantalla de cocina", text: "Un ticket por mesa con opciones y notas. Cocina marca cuándo empieza y cuándo está listo; los cambios llegan marcados." },
  { icon: "✏️", title: "Cambios bajo control", text: "Antes de preparar, el comensal cambia lo que quiera. Si ya empezó, pide el cambio y el mesero decide con cocina." },
  { icon: "🍽️", title: "Menú y opciones propias", text: "Platos, precios, categorías y opciones (quitar ingredientes, extras, término). Los precios los calcula el servidor, nunca el cliente." },
  { icon: "💵", title: "Caja y precios en bolívares", text: "Precios en dólares, bolívares o ambos con la tasa oficial del BCV o la tuya. Confirma pagos, cobra por mesa y ve lo cobrado hoy por método." },
  { icon: "🏷️", title: "NFC y QR para tus mesas", text: "Imprime QR o graba etiquetas NFC desde el panel. Se pueden usar por mesa o por asiento, y tú decides cuánto control quieres." },
];

/** Lo que Appetito hace hoy y lo que todavía no. */
const can = [
  "Pedir, ajustar y cancelar platos desde el móvil de cada comensal",
  "Que el mesero tome pedidos por cada comensal desde su tablet",
  "Mostrar a cocina los pedidos en vivo, plato por plato",
  "Elegir mesa y asiento sin escanear (con código o permiso del mesero)",
  "Proteger las mesas de quien no está en el local",
  "Gestionar equipo, mesas, menú y ajustes con permisos por rol",
  "Ver los precios en bolívares con la tasa oficial del BCV o la tuya, y repartir y registrar los pagos de la mesa",
  "Funcionar como app instalable en Android e iPhone (PWA)",
];
const cannot = [
  "Procesar pagos o tarjetas dentro de la app: Appetito registra quién paga qué y el pago se hace como siempre",
  "Cobrar al momento de pedir o abrir cuentas para clubes (en preparación)",
  "Pedir a domicilio o para llevar: es una app para comer en el local",
  "Reservar mesa por adelantado desde la app (el restaurante marca sus reservas)",
  "Notificaciones push y publicación en tiendas de apps (por ahora se instala desde el navegador)",
  "Funcionar sin conexión a internet",
];

/** Tipos de local para los que sirve. */
const audiences = [
  { icon: "🍝", title: "Restaurantes de mantel", text: "El mesero se queda con lo que importa (atender y recomendar) y el pedido llega sin errores." },
  { icon: "🍻", title: "Bares y pubs", text: "Pedidos rápidos sin gritar ni hacer fila en la barra, con rondas que cada quien agrega desde su móvil." },
  { icon: "☕", title: "Cafeterías y panaderías", text: "Pedir desde la mesa y cambiar un detalle sin interrumpir a nadie." },
  { icon: "🌴", title: "Terrazas, playas y food courts", text: "Mucha gente y pocos meseros: cada quien pide solo y el personal solo sirve." },
  { icon: "🏨", title: "Hoteles y clubes", text: "Restaurantes y bares dentro de hoteles, clubes o eventos, con carta propia y varios roles." },
  { icon: "🎓", title: "Comedores y cafeterías institucionales", text: "Universidades, empresas y colegios con mucha rotación y horas pico." },
];

const advantages = [
  { title: "Menos esperas", text: "Nadie espera a que el mesero pase para pedir, cambiar algo o pedir la cuenta." },
  { title: "Menos errores", text: "El pedido se escribe una vez, con sus detalles, y lo ve cocina tal cual." },
  { title: "Meseros con más tiempo", text: "Dejan de ser mensajeros y atienden mejor. Si prefieren tomar el pedido, también pueden." },
  { title: "Sin hardware caro", text: "Funciona con los móviles y las tablets que ya tienes. Las etiquetas NFC cuestan céntimos." },
  { title: "No te obliga a nada", text: "Cada restaurante decide cómo se pide, cómo se entra a la mesa y cuánto control quiere." },
  { title: "Nada que instalar para empezar", text: "Se abre en el navegador; quien quiera, la instala con un toque." },
];

const steps = [
  { n: "1", title: "Entra a tu mesa", text: "Escanea el QR, acerca el móvil a la etiqueta NFC o elige tu mesa en la app. Sin crear cuenta." },
  { n: "2", title: "Pide y ajusta", text: "Elige del menú y ajusta tu plato: sin salsa, extra de queso…" },
  { n: "3", title: "Cambia hasta que cocina empiece", text: "Tu pedido queda guardado y tu mesero lo ve en vivo." },
];

const privacy = [
  "No necesitas cuenta para pedir: entras como invitado.",
  "Tu ubicación solo se usa si tú la das, para ordenar los restaurantes cercanos; no se guarda.",
  "Los precios los calcula el servidor: nadie puede cambiar lo que paga desde su móvil.",
  "Una foto del QR de la mesa no basta para sentarse: con la mesa ocupada se necesita invitación, código o permiso del mesero.",
  "Cada restaurante solo ve lo suyo; cada comensal solo ve su mesa.",
  "El NFC sirve para identificar tu mesa. No procesa pagos ni guarda datos de tarjetas.",
];

const faqs = [
  { q: "¿Tengo que descargar una app?", a: "No. Appetito se abre en el navegador. Si quieres, la instalas en tu pantalla de inicio con un toque, como una app." },
  { q: "¿Y si mi móvil no tiene NFC?", a: "Escaneas el QR de la mesa o eliges tu mesa y asiento en la app. El NFC es una comodidad, no un requisito." },
  { q: "¿Qué pasa si quiero cambiar un plato que ya se está cocinando?", a: "Pides el cambio desde la app y el mesero lo consulta con cocina. Si cocina aún no empezó, lo cambias tú directamente." },
  { q: "¿Los meseros dejan de tomar pedidos?", a: "No. El restaurante elige: que solo tome el mesero, que pida cada comensal o ambos a la vez. Appetito no quita al mesero, le quita el trabajo repetitivo." },
  { q: "¿Cuánto cuesta?", a: "Hoy es gratis. Estamos construyéndolo con restaurantes reales y ajustándolo a lo que necesitan." },
  { q: "¿Cómo lo uso en mi restaurante?", a: "Entra a «Soy un restaurante», crea tu cuenta, añade tu menú y tus mesas, imprime los QR o graba etiquetas NFC e invita a tu equipo." },
];

export default function Home() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-5">
        <a href="#" className="text-xl font-bold tracking-tight text-tomato">
          appetito
        </a>
        <nav className="flex items-center gap-6 text-sm font-medium text-muted">
          <a href="#que-es" className="hidden hover:text-foreground md:inline">
            Qué es
          </a>
          <a href="#comensales" className="hidden hover:text-foreground md:inline">
            Para comensales
          </a>
          <a href="#restaurantes" className="hidden hover:text-foreground md:inline">
            Para restaurantes
          </a>
          <a href="#descargar" className="hidden hover:text-foreground sm:inline">
            Instalar
          </a>
          <Link href="/panel" className="hidden hover:text-foreground sm:inline">
            Soy un restaurante
          </Link>
          <Link
            href="/app"
            className="inline-flex h-10 items-center rounded-full bg-tomato px-5 font-semibold text-white hover:bg-tomato-dark"
          >
            Abrir app
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 pb-16 pt-12 text-center sm:pt-20">
          <p className="mb-4 inline-block rounded-full bg-tomato/10 px-3 py-1 text-sm font-medium text-tomato">
            Pide a tu manera
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Tu menú favorito,
            <br />
            <span className="text-tomato">a un toque de distancia.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Pide, ajusta tu plato y llama al mesero desde tu móvil. Sin cuenta, sin descargas y sin esperas.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center rounded-full bg-tomato px-6 font-semibold text-white transition-colors hover:bg-tomato-dark"
            >
              Abrir Appetito
            </Link>
            <Link
              href="/panel"
              className="inline-flex h-12 items-center justify-center rounded-full border border-line px-6 font-medium transition-colors hover:bg-card"
            >
              Tengo un restaurante
            </Link>
            <DownloadButton />
          </div>
        </section>

        <Section id="que-es" title="Qué es Appetito" intro="Una plataforma de pedidos para restaurantes que une dos mundos: el comensal que quiere pedir a su ritmo y el equipo que necesita un servicio ordenado.">
          <div className="mx-auto max-w-3xl space-y-4 text-center text-lg text-muted">
            <p>
              En un restaurante, pedir una bebida, cambiar «sin cebolla» o pedir la cuenta suele depender de atrapar a un
              mesero ocupado. Eso genera esperas, malentendidos y platos mal hechos.
            </p>
            <p>
              Appetito pone el pedido en el móvil de cada persona y en las pantallas del equipo, todo conectado en vivo.
              Cada mesa tiene <strong className="text-foreground">una sola cuenta compartida</strong>: cada comensal agrega y
              cambia sus propios platos, el mesero puede hacerlo por cualquiera, y todo se suma a la cuenta de la mesa.
              Nadie se ve obligado a usar una forma u otra.
            </p>
          </div>
        </Section>

        <Section id="como-funciona" title="Así de simple">
          <ol className="grid gap-6 sm:grid-cols-3">
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
        </Section>

        <Section id="comensales" title="Para quien come" intro="Pedir debería ser lo más fácil de la comida.">
          <CardGrid items={dinerFeatures} />
        </Section>

        <Section id="restaurantes" title="Para el restaurante" intro="Herramientas pensadas para el día a día de un local, de cualquier tamaño.">
          <CardGrid items={restaurantFeatures} />
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-line bg-card p-5 text-center">
            <p className="font-semibold">Tú decides cómo trabaja tu local</p>
            <p className="mt-1 text-sm text-muted">
              Atendido (solo el mesero), NFC/QR opcional o NFC/QR completo · mesa libre con QR o solo abierta por el
              mesero · cambios hasta que cocina empiece o hasta que esté listo. La idea no es restringir, sino ofrecer
              alternativas mejores sin forzarlas.
            </p>
          </div>
        </Section>

        <Section id="alcance" title="Qué se puede y qué no (todavía)" intro="Preferimos ser claros con lo que hoy hace Appetito.">
          <div className="grid gap-6 md:grid-cols-2">
            <ListCard title="✅ Hoy se puede" items={can} />
            <ListCard title="🚧 Aún no" items={cannot} muted />
          </div>
        </Section>

        <Section id="ventajas" title="Ventajas de usarlo">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {advantages.map((a) => (
              <div key={a.title} className="rounded-2xl border border-line bg-card p-5">
                <h3 className="font-semibold text-tomato">{a.title}</h3>
                <p className="mt-1 text-sm text-muted">{a.text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="para-quien" title="¿Para quién es?" intro="Cualquier lugar donde se come o se bebe sentado y hay un equipo atendiendo.">
          <CardGrid items={audiences} />
        </Section>

        <Section id="seguridad" title="Privacidad y seguridad">
          <ul className="mx-auto max-w-3xl space-y-3">
            {privacy.map((p) => (
              <li key={p} className="flex gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
                <span aria-hidden="true">🔒</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="preguntas" title="Preguntas frecuentes">
          <div className="mx-auto max-w-3xl space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="rounded-2xl border border-line bg-card px-5 py-4">
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mt-2 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <Section id="proyecto" title="Sobre el proyecto">
          <div className="mx-auto max-w-3xl space-y-3 text-center text-muted">
            <p>
              Appetito nació como un proyecto universitario: una idea para hacer más simple pedir en un restaurante.
              Después fue reconstruido desde cero y se sigue desarrollando como un producto propio, pensado para
              restaurantes reales.
            </p>
            <p>
              Creado y desarrollado por <strong className="text-foreground">Carlos González</strong>. El código está en{" "}
              <a href="https://github.com/charlievaibs/appetito" className="font-semibold text-tomato underline">
                GitHub
              </a>
              .
            </p>
          </div>
        </Section>

        <section id="descargar" className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-16">
          <div className="rounded-3xl bg-tomato px-6 py-14 text-center text-white">
            <h2 className="text-3xl font-bold tracking-tight">Llévalo en tu bolsillo</h2>
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
        <Link href="/panel" className="underline">
          ¿Tienes un restaurante? Entra al panel
        </Link>
        <p className="mt-2">© 2026 Appetito</p>
      </footer>
    </>
  );
}

/** Sección de la portada con título, introducción opcional y ancla para el menú. */
function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-14">
      <h2 className="text-center text-3xl font-bold tracking-tight">{title}</h2>
      {intro && <p className="mx-auto mt-3 max-w-2xl text-center text-muted">{intro}</p>}
      <div className="mt-10">{children}</div>
    </section>
  );
}

function CardGrid({ items }: { items: { icon: string; title: string; text: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="rounded-2xl border border-line bg-card p-5">
          <p className="text-2xl" aria-hidden="true">
            {item.icon}
          </p>
          <h3 className="mt-2 font-semibold">{item.title}</h3>
          <p className="mt-1 text-sm text-muted">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

function ListCard({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h3 className="font-semibold">{title}</h3>
      <ul className={`mt-3 space-y-2 text-sm ${muted ? "text-muted" : ""}`}>
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
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
