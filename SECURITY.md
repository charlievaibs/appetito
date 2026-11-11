# Seguridad del enlace de descarga

Objetivo: **que nadie pueda hacer que Appetito entregue un APK distinto al oficial**, ni cambiando el enlace ni
reemplazando el archivo.

## Cómo está construido

1. **El enlace está en el código, no en la configuración.** [`src/lib/release.ts`](src/lib/release.ts) fija la
   versión y la huella SHA-256 del APK. No hay variable de entorno ni panel que lo cambie.
2. **La web nunca enlaza a GitHub.** El botón apunta a `/descargar`, una ruta propia que baja el APK de GitHub,
   **comprueba la huella** y solo entonces lo entrega. Si un byte difiere, responde 502 y no sirve nada
   ([`src/lib/apk-verify.ts`](src/lib/apk-verify.ts)).
3. **Origen cerrado:** solo HTTPS y solo `github.com` / almacén de releases de GitHub; cada redirección se revisa a mano;
   tamaño máximo; comparación de huella en tiempo constante; la ruta no acepta parámetros.
4. **Firma propia.** El APK se firma con una clave que solo existe en el entorno `release` de GitHub y en tu copia
   local. Android rechaza instalar una actualización firmada con otra clave.
5. **Cabeceras:** CSP (sin `object-src`, `base-uri`, `form-action` ni `frame-ancestors` ajenos), `X-Frame-Options: DENY`,
   `nosniff`, HSTS (Vercel) y Permissions-Policy.
6. **Cadena de suministro:** acciones de GitHub fijadas por commit, `npm ci` con lockfile, `npm audit` y Dependabot,
   token del flujo de trabajo de solo lectura salvo al publicar.

## Riesgos y mitigaciones

| # | Riesgo | Mitigación | Qué queda |
|---|---|---|---|
| 1 | Cambiar el enlace con una variable de entorno en Vercel | El enlace no sale de variables; hay un test que lo comprueba | — |
| 2 | Cuenta de Vercel comprometida (redeploy con otro código) | El archivo se verifica contra la huella del código que se despliega; 2FA | Un atacante con Vercel puede desplegar otro código: **activa 2FA** |
| 3 | Reemplazar `appetito.apk` en la release de GitHub | La ruta `/descargar` rechaza cualquier archivo con otra huella; releases inmutables | — |
| 4 | Crear una release nueva para que «latest» apunte a otro APK | No se usa «latest»: se descarga la versión fijada | — |
| 5 | Push malicioso a `main` (cuenta de GitHub comprometida) | Reglas del repositorio (sin forzar ni borrar), tags `v*` protegidos, 2FA | Un administrador con la cuenta robada puede cambiar el código: **2FA/passkey** |
| 6 | Modificar el flujo de compilación para robar la clave | Secretos solo en el entorno `release`; acciones fijadas; permisos mínimos | Revisa cambios en `.github/` |
| 7 | Redirección desde GitHub a un servidor ajeno | Lista cerrada de dominios, solo HTTPS, sin puertos ni credenciales | — |
| 8 | Intermediario (MITM) en la descarga | HTTPS + HSTS en la web y en GitHub; verificación de huella en servidor | — |
| 9 | Inyección de un enlace falso en la página (XSS) | React escapa el contenido; sin `dangerouslySetInnerHTML`; CSP | `script-src` permite en línea (lo usa Next) |
| 10 | Incrustar la web en otra para engañar (clickjacking) | `frame-ancestors 'none'` y `X-Frame-Options: DENY` | — |
| 11 | Dependencia de npm comprometida | Lockfile, `npm audit` en CI, Dependabot | Riesgo residual de cualquier proyecto |
| 12 | Acción de GitHub secuestrada | Acciones fijadas por commit | — |
| 13 | Clave de firma robada o perdida | Copia fuera del repositorio; solo en el entorno `release`; si se pierde hay que reinstalar | Guarda la copia en dos sitios |
| 14 | Web falsa con otro dominio parecido | No evitable desde el código; la huella publicada permite comprobarlo | Usa siempre el dominio oficial |
| 15 | La app Android abre contenido ajeno en su WebView | Navegación limitada a nuestro dominio, sin HTTP, sin depuración remota | Si la web se comprometiera, la app también |
| 16 | Copias de seguridad de Android que filtran datos | `allowBackup="false"` | — |

## Ataques probados contra el sistema (31 de octubre de 2026)

Se intentó romper cada defensa; todas resistieron.

| Intento | Resultado |
|---|---|
| Cambiar la descarga con `?url=`, `?version=`, `?next=` y rutas con `..` | Se ignoran: siempre la misma respuesta fija |
| Métodos `POST/PUT/DELETE/PATCH`, `X-Forwarded-Host`, `X-Original-URL`, inyección de cabecera `Location` | 405 / sin efecto |
| Compilar con `NEXT_PUBLIC_APK_URL=https://evil.example/...` | La web compilada no contiene el dominio; el botón no cambia |
| APK real con 1 bit cambiado (inicio, medio, final), con 1 KB añadido, truncado o reemplazado | Rechazado en todos los casos |
| Redirección de GitHub a otro dominio, dominio parecido, HTTP, puerto raro, credenciales en la URL, bucle | Bloqueado sin llegar a pedir al destino |
| Versión o huella manipuladas (`1.2.3/../../x`, huella en mayúsculas) | Rechazado como configuración no válida |
| Sin credenciales: crear release o etiqueta, subir archivos, editar el flujo, leer secretos, `git push` | 401 / sin acceso |
| Inyectar `<base>` para desviar el enlace `/descargar` | La política lo ignora; el enlace sigue en nuestro dominio |
| Cargar un script ajeno, hacer `fetch` a otro dominio, enviar un formulario a otro dominio | Bloqueado por la CSP |
| Incrustar la web en un iframe (clickjacking) | Bloqueado por `frame-ancestors` |
| XSS reflejado con `<img onerror>` y `<script>` en la ruta y en `?a=` | No se ejecuta ni se inserta |
| Buscar claves, certificados o `.env` en todo el historial de git | Nada (solo el patrón del propio test) |
| `npm audit` | 0 vulnerabilidades |

## Límites que conviene conocer

- **`script-src` permite scripts en línea** porque Next.js los usa para arrancar. Mitiga que React escapa todo y que no hay
  `dangerouslySetInnerHTML`; el siguiente paso sería una CSP con *nonce*.
- **Tu cuenta de GitHub y la de Vercel son el eslabón más débil:** quien las controle puede cambiar el código. Activa
  verificación en dos pasos (idealmente passkey) en ambas.
- **Coste de la descarga:** cada petición sin caché baja el APK de GitHub y lo verifica; la red de reparto lo guarda 24 h.
- **Clave de firma perdida = reinstalar:** hay una copia en `appetito-llaves/` (fuera del repositorio). Guárdala también en otro sitio.

## Cuentas del equipo

- **Enlaces para unirse:** caducan (1–30 días), tienen usos limitados, se pueden revocar y no existen para el rol de dueño; quien los usa debe tener una cuenta con el correo confirmado (un invitado no puede).
- **Crear cuentas de empleados:** la hace una Edge Function de Supabase (`create-staff`). La clave de administración solo existe allí; la función exige una sesión real de dueño o gerente y comprueba en la base de datos que pueda administrar ese rol. Sin sesión o con un token falso responde 401 (probado). La contraseña temporal se entrega una vez y la persona debe cambiarla al entrar.
- **Bajas:** exigen escribir el nombre o el correo de la persona (lo verifica la base de datos), nunca dejan al restaurante sin dueño y quedan en un registro de actividad. Suspender es reversible.

## API pública y claves

- **Claves:** 24 bytes aleatorios (`apt_…`); en la base solo se guarda su huella SHA-256, nunca la clave. Se muestra una sola vez al crearla. Se pueden revocar y hay un máximo de 10 activas por local.
- **Alcance:** cada clave pertenece a un restaurante y solo ve y cambia sus datos; las de solo lectura no pueden escribir. La comprobación ocurre en la base (`private.api_auth`), no en la web.
- **Transporte:** la clave solo viaja en la cabecera `Authorization` (Bearer o Basic); no se acepta por la URL, para que no quede en registros. Las respuestas no se guardan en caché.
- **Entrada:** cuerpo máximo de 2 MB y 2000 filas; cada fila se valida y falla por separado. Las consultas OData se resuelven en memoria con una lista cerrada de campos y funciones, sin construir SQL con el texto recibido.
- **Archivos Excel:** se leen sin ejecutar nada (solo XML); se limitan tamaño, hojas y filas, y se descomprime solo lo necesario. Al exportar, las celdas que parecen fórmulas se neutralizan.
- **Límite de uso:** 120 peticiones por minuto por clave; al pasarlo la API responde 429 con `Retry-After`. El contador está en la base, así que vale aunque haya varias instancias del servidor.

## Verificar un APK a mano

```bash
sha256sum appetito-<versión>.apk          # debe coincidir con la huella de la página
apksigner verify --print-certs appetito-<versión>.apk   # el SHA-256 del certificado debe ser el publicado
```

## Publicar una versión nueva

1. Crea y sube la etiqueta de versión (solo un administrador puede): `git tag vX.Y.Z && git push origin vX.Y.Z`. El flujo **Android APK** compila, firma y publica la release (te pedirá aprobar el entorno `release`).
2. Copia la huella SHA-256 que aparece en el resumen de la ejecución.
3. Edita `src/lib/release.ts` con la versión y la huella, y haz commit. Solo entonces la web ofrece la versión nueva.

## Cómo informar de una vulnerabilidad

Usa «Report a vulnerability» en la pestaña Security del repositorio.
