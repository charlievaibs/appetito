# Appetito

**Pide, ajusta tu plato y llama al mesero desde tu móvil. Sin cuenta, sin descargas y sin esperas.**
Plataforma de pedidos para restaurantes: web instalable (PWA), gratis y pensada para móvil y tablet.

**Web:** https://getappetito.vercel.app

## Qué es y para qué sirve

En un restaurante, pedir, cambiar «sin cebolla» o pedir la cuenta suele depender de atrapar a un mesero ocupado.
Eso provoca esperas, malentendidos y platos mal hechos. Appetito pone el pedido en el móvil de cada comensal y en las
pantallas del equipo (mesero, cocina, caja), todo conectado en tiempo real.

Cada mesa tiene **una sola cuenta compartida**: cada comensal agrega, cambia o cancela sus propios platos (y el mesero puede
hacerlo por cualquiera), y todo se suma a la cuenta de la mesa, con cada plato atribuido a quien lo pidió. Nada es obligatorio:
cada restaurante elige cómo trabajar y la app invita a usar lo más cómodo, sin forzarlo.

## Por qué se hizo

Appetito **nació como un proyecto universitario**: una idea para que pedir en un restaurante fuera más simple. Después se
reconstruyó desde cero con otra tecnología y se sigue desarrollando como un producto propio, pensado para restaurantes
reales. Idea, concepto y desarrollo actual de **Carlos González**.

## Ventajas

- **Menos esperas:** nadie espera a que el mesero pase para pedir, cambiar un plato o pedir la cuenta.
- **Menos errores:** el pedido se escribe una vez, con sus detalles, y cocina lo ve tal cual.
- **Meseros con más tiempo** para atender y recomendar; si prefieren tomar el pedido, pueden.
- **Sin hardware caro:** funciona con los móviles y tablets que ya hay; las etiquetas NFC cuestan céntimos.
- **No obliga a nada:** el restaurante decide cómo se pide, cómo se entra a la mesa y cuánto control quiere.
- **Nada que instalar para empezar:** se abre en el navegador y se puede instalar con un toque.

## Casos de uso y clientes potenciales

| Tipo de local | Qué aporta Appetito |
|---|---|
| Restaurantes de mantel | El mesero se dedica a atender; el pedido llega a cocina sin errores |
| Bares y pubs | Pedidos y rondas sin gritar ni hacer fila en la barra |
| Cafeterías y panaderías | Pedir desde la mesa y cambiar un detalle sin interrumpir |
| Terrazas, playas y *food courts* | Mucha gente y pocos meseros: cada quien pide solo |
| Hoteles, clubes y eventos | Cartas propias, varios roles y varias zonas |
| Comedores institucionales (universidades, empresas, colegios) | Horas pico con mucha rotación |

## Qué se puede hacer (y qué no, todavía)

**Hoy se puede**

- Entrar a la mesa **sin cuenta**: acercando el móvil a una etiqueta **NFC**, escaneando un **QR** o **eligiendo mesa y asiento** en la app.
- Pedir, **ajustar** («sin salsa», extras, término) y cancelar platos, hasta que cocina empiece (o hasta que esté listo, según el local).
- Pedir un cambio sobre un plato **ya en preparación**: el mesero lo consulta con cocina y lo acepta o rechaza.
- **Llamar al mesero** y **pedir la cuenta** con un toque; **invitar** a acompañantes con un QR que se renueva solo.
- Ver lo que pidió cada quien y el estado de cada plato en vivo.
- Para el equipo: salón con las mesas en pantalla, pantalla de cocina, tablero de pedidos, menú con opciones, mesas y QR/NFC, equipo con roles y ajustes.
- Instalarla como app en Android e iPhone (PWA).

**Todavía no**

- Cobrar dentro de la app (el pago se hace como siempre) y dividir la cuenta por persona.
- Pedidos a domicilio o para llevar: es una app para comer en el local.
- Reservar mesa por adelantado desde la app (el restaurante marca sus reservas en el panel).
- Notificaciones push, publicación en tiendas de apps y funcionamiento sin conexión.

## Dos vistas

| Vista | Rutas | Para quién |
|---|---|---|
| Comensal | `/app`, `/m/<código>`, `/i/<invitación>`, `/mesa`, `/r/<restaurante>` | Quien come: directorio, entrar a la mesa, pedir y ajustar |
| Personal | `/panel` y sus secciones (Pedidos, Salón, Cocina, Tomar pedido, Mesas, Menú, Equipo, Ajustes) | Dueño y equipo del restaurante |

## Equipo y roles

Desde un local con una sola persona hasta uno grande. Cada rol ve y puede hacer solo lo suyo (lo aplica la base de datos):

| Rol | Puede |
|---|---|
| Dueño | Todo, incluido el equipo |
| Gerente | Menú, mesas, ajustes y equipo (menos dueños y gerentes) |
| Anfitrión | Mesas, reservas, tomar pedidos y servir |
| Mesero | Tomar pedidos, enviarlos a cocina, servir y cerrar mesas; decide los cambios que piden los comensales |
| Cocina | Ver pedidos, prepararlos y marcarlos listos |
| Caja | Ver pedidos y cerrar mesas |

Se invita por correo desde `/panel/equipo`; la persona se une al entrar con ese correo **ya confirmado**
(mantén activada la confirmación de correo en Supabase en producción).

## Cómo se protege una mesa (que una foto del QR no baste)

El QR o NFC fijo **identifica** la mesa, pero no autoriza si ya hay alguien sentado:

- Con la mesa ocupada o reservada, quien escanea el QR fijo **pide permiso** al mesero.
- Para unirse, el grupo escanea una **invitación que cambia sola cada pocos minutos** (en la tablet del mesero o en el móvil de quien ya está sentado), usa un código o espera la aprobación.
- Dos modos por restaurante: **informal** (el QR abre una mesa libre, que queda «por confirmar» y no llega a cocina hasta que el mesero la confirma) o **estricto** (solo el mesero abre las mesas).

## Etiquetas NFC y avisos

Una etiqueta NFC y un QR llevan la misma dirección (`/m/<código>`), así que funcionan en iPhone y Android sin instalar nada.
Desde `/panel/mesas/qr` el restaurante imprime los QR o, en Chrome para Android, **graba etiquetas NFC** con un toque
(Web NFC; leerlas no requiere nada). Hay etiquetas de mesa, de puesto y de **servicio** (`?a=mesero`, `?a=cuenta`).
El NFC identifica; no procesa pagos.

## Elegir mesa a mano (sin NFC ni QR)

Desde la ficha del restaurante el comensal puede **elegir su mesa y su asiento**, como butacas en un cine. Cada restaurante decide el
modo en *Ajustes*: **libres entran directo**, **con permiso del mesero** o **solo con NFC/QR**. Las mesas ocupadas o reservadas se abren
con un **código** (el de la reserva o el de la mesa) o esperando a que el mesero dé acceso.

## Cómo se decide en qué restaurante estás

En orden de fiabilidad: etiqueta NFC/QR de la mesa → mesa recordada en el dispositivo (abrir la app te lleva directo a pedir) →
ubicación aproximada (solo si la das; sugiere, nunca pide sola) → directorio.

## Configuración por restaurante

- **Cómo se piden los platos:** atendido (solo personal), NFC/QR opcional, o NFC/QR completo.
- **Cómo se identifica al comensal:** por mesa, por puesto o por reserva.
- **Hasta cuándo se cambia un plato:** hasta que cocina empiece, o hasta que esté listo.
- **Elegir mesa a mano:** libres entran directo, con permiso del mesero o desactivado.
- **Seguridad de mesa:** informal o estricto.

## Tecnologías

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime, RLS) · Vitest · Capacitor (envoltorio Android)

## Seguridad

Toda la seguridad vive en la base de datos (RLS y funciones), no en la interfaz:

- Los comensales no escriben en las tablas: solo llaman a funciones que validan permisos y **calculan los precios**.
- Cada restaurante solo ve lo suyo; los comensales solo ven su mesa.
- Las claves del cliente son públicas por diseño. Nunca se sube ninguna clave secreta.
- El enlace de descarga del APK está fijado en el código y el archivo se verifica antes de entregarse: ver [SECURITY.md](SECURITY.md).

## Desarrollo

```bash
npm install
cp .env.example .env.local   # y rellena los valores de tu proyecto de Supabase
npm run dev                  # http://localhost:3000
npm test                     # tests de la lógica
npm run lint
npm run build
```

### Supabase

1. Crea un proyecto y aplica, en orden, los archivos de [`supabase/migrations`](supabase/migrations)
   (tablas, políticas y funciones; con la CLI: `supabase link` y `supabase db push`, o pega cada archivo en el SQL Editor).
   Incluyen un restaurante de demostración con el slug `demo`.
2. En *Authentication → Sign In / Providers* activa **Allow anonymous sign-ins** (los comensales entran como invitados).
3. En *Authentication → URL Configuration* pon tu **Site URL** y añade tus direcciones a **Redirect URLs**.
4. Copia la URL y la clave publicable a `.env.local`.

## Estructura

```
src/
  app/(diner)/     vista del comensal: /app, /m/[token], /i/[token], /mesa, /r/[slug]
  app/(panel)/     vista del personal: /panel/...
  components/      interfaz (diner/ y panel/ son específicos de cada vista)
  lib/             lógica pura con tests (reglas de pedido, errores, directorio…) y acceso a Supabase
supabase/migrations/   esquema completo de la base de datos
android/               envoltorio Android (Capacitor)
```

## Próximamente

- Dividir la cuenta por comensal y editor de opciones de cada plato
- Fotos reales de los platos y etiqueta NFC de entrada al restaurante
- Publicación del APK de Android y límite de intentos en los códigos de mesa
