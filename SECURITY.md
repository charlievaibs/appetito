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

## Verificar un APK a mano

```bash
sha256sum appetito-<versión>.apk          # debe coincidir con la huella de la página
apksigner verify --print-certs appetito-<versión>.apk   # el SHA-256 del certificado debe ser el publicado
```

## Publicar una versión nueva

1. Ejecuta el flujo **Android APK** (versión `X.Y.Z`, marcando publicar).
2. Copia la huella SHA-256 que aparece en el resumen de la ejecución.
3. Edita `src/lib/release.ts` con la versión y la huella, y haz commit. Solo entonces la web ofrece la versión nueva.

## Cómo informar de una vulnerabilidad

Usa «Report a vulnerability» en la pestaña Security del repositorio.
