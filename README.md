# Appetito

Explora el menú y arma tu pedido en un toque. Web instalable, gratis y pensada para móvil.

**Web:** https://getappetito.vercel.app

Inspirada en un proyecto universitario (Unimet) de menú y pedidos de restaurante; el código se reescribió desde cero.

## Qué tiene hoy

- Menú con búsqueda y filtro por categoría
- Detalle de cada plato con selector de cantidad
- Carrito que se guarda en el navegador (no se pierde al recargar)
- Precios manejados en céntimos, sin errores de decimales
- Lógica del carrito separada de la interfaz y cubierta con tests

> El botón «Confirmar pedido» es una demostración: todavía no guarda ni envía pedidos.

## Próximamente

- Base de datos y pedidos reales con Supabase
- Instalación como app en Android (APK) y PWA
- Fotos reales de los platos y panel para editar el menú

## Tecnologías

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Vitest

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # tests de la lógica del carrito
npm run lint
npm run build
```

## Estructura

```
src/
  app/            rutas (landing, /menu, /menu/[id], /carrito)
  components/     interfaz
  data/menu.ts    platos de ejemplo
  lib/            carrito (reducer, almacenamiento) y utilidades, con tests
```
