# Appetito

Pide desde tu mesa sin llamar al mesero, y sin quitarle trabajo al mesero que prefiere tomar el pedido.
Web instalable, gratis y pensada para móvil y tablet.

**Web:** https://getappetito.vercel.app

Inspirada en un proyecto universitario (Unimet) de menú y pedidos de restaurante; el código se reescribió desde cero.

## La idea

Hay **un único pedido vivo por mesa** y el mesero y el comensal son dos formas igual de válidas de escribir en él.
Nada es obligatorio: cada restaurante elige cómo trabajar y la app invita a usar lo más cómodo.

- El comensal entra **acercando el móvil a una etiqueta NFC** o escaneando un **QR** de su mesa o puesto. Sin cuenta.
- Puede pedir, **ajustar sus platos** (sin salsa, extra de queso…) y ver su historial.
- El mesero sigue en su tablet: toma pedidos para cada comensal, ve en vivo lo que piden en la mesa y lo gestiona.
- Los cambios se pueden hacer **hasta que cocina empiece** (o hasta que esté listo, según el restaurante).

## Dos vistas

| Vista | Ruta | Para quién |
|---|---|---|
| Comensal | `/app`, `/m/<código>`, `/mesa`, `/r/<restaurante>` | Quien come: directorio, entrada por NFC/QR, pedir y ajustar |
| Personal | `/panel` | Dueño y equipo: pedidos en vivo, tomar pedido, mesas y QR, menú, ajustes |

## Cómo se decide en qué restaurante estás

En orden de fiabilidad: etiqueta NFC/QR de la mesa → mesa recordada en el dispositivo (abrir la app te lleva directo a pedir) →
ubicación aproximada (solo si la das; sugiere, nunca pide sola) → directorio.

## Configuración por restaurante

- **Cómo se piden los platos:** atendido (solo personal), NFC/QR opcional, o NFC/QR completo.
- **Cómo se identifica al comensal:** por mesa, por puesto o por reserva.
- **Hasta cuándo se cambia un plato:** hasta que cocina empiece, o hasta que esté listo.

## Tecnologías

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime, RLS) · Vitest

## Seguridad

Toda la seguridad vive en la base de datos (RLS y funciones), no en la interfaz:

- Los comensales no escriben en las tablas: solo llaman a funciones que validan permisos y **calculan los precios**.
- Cada restaurante solo ve lo suyo; los comensales solo ven su mesa.
- Las claves del cliente son públicas por diseño. Nunca se sube ninguna clave secreta.

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

1. Crea un proyecto y aplica el esquema (tablas, políticas y funciones). **Pendiente:** hoy el esquema vive solo en el
   historial de migraciones del proyecto de Supabase (*Database → Migrations*); exportarlo a `supabase/migrations`
   en este repositorio es el siguiente paso para poder recrearlo desde cero.
2. En *Authentication → Sign In / Providers* activa **Allow anonymous sign-ins** (los comensales entran como invitados).
3. En *Authentication → URL Configuration* pon tu **Site URL** y añade tus direcciones a **Redirect URLs**.
4. Copia la URL y la clave publicable a `.env.local`.

## Estructura

```
src/
  app/(diner)/     vista del comensal: /app, /m/[token], /mesa, /r/[slug]
  app/(panel)/     vista del personal: /panel/...
  components/      interfaz (diner/ y panel/ son específicos de cada vista)
  lib/             lógica pura con tests (reglas de pedido, errores, directorio…) y acceso a Supabase
```

## Próximamente

- Roles del equipo (gerente, anfitrión, mesero, cocina, caja) con invitaciones por correo
- Escribir etiquetas NFC desde el panel y avisos de «llamar al mesero» y «pedir la cuenta»
- Editor de opciones de cada plato, fotos reales y dividir la cuenta por comensal
- Instalación como app en Android (APK) y PWA
