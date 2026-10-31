/**
 * Pruebas de seguridad del enlace de descarga. Leen el código fuente y la configuración
 * del repositorio para impedir, con un test que falla, que alguien reabra una vía por la
 * que se pueda cambiar el APK que ofrece la web.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RELEASE, SHA256_PATTERN, SIGNING_CERT_SHA256, VERSION_PATTERN } from "./release";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(join(root, path)).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Código de la app, sin los tests (que nombran justo lo que prohíben). */
const appFiles = () => sourceFiles("src").filter((f) => !f.endsWith(".test.ts"));

describe("enlace de descarga fijado en el código", () => {
  it("la versión publicada tiene un formato válido (o no hay ninguna)", () => {
    if (RELEASE) {
      expect(RELEASE.version).toMatch(VERSION_PATTERN);
      expect(RELEASE.sha256).toMatch(SHA256_PATTERN);
    }
    if (SIGNING_CERT_SHA256) expect(SIGNING_CERT_SHA256).toMatch(SHA256_PATTERN);
  });

  it("ningún archivo de la descarga lee variables de entorno", () => {
    for (const file of ["src/lib/release.ts", "src/lib/apk-verify.ts", "src/app/descargar/route.ts", "src/app/page.tsx"]) {
      expect(read(file), file).not.toMatch(/process\.env|import\.meta\.env/);
    }
  });

  it("la antigua variable del enlace ya no existe en ningún sitio", () => {
    const files = [...appFiles(), ".env.example", "next.config.ts", "capacitor.config.ts"];
    for (const file of files) {
      expect(read(file), file).not.toContain("NEXT_PUBLIC_APK_URL");
    }
  });

  it("solo release.ts conoce la dirección de GitHub Releases", () => {
    for (const file of appFiles()) {
      if (file.endsWith("lib/release.ts")) continue;
      expect(read(file), file).not.toMatch(/github\.com\/[^"'\s]*releases/);
      // La ruta de descarga solo nombra el archivo que entrega; ningún otro código enlaza a un .apk.
      if (!file.endsWith("descargar/route.ts")) expect(read(file), file).not.toMatch(/\.apk["'`]/);
    }
  });

  it("el botón de la portada apunta siempre a la ruta verificada", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain('href="/descargar"');
    expect(page).not.toMatch(/href=\{[^}]*(url|URL|apk)/);
  });

  it("la ruta de descarga no lee nada de la petición", () => {
    const route = read("src/app/descargar/route.ts");
    expect(route).not.toMatch(/searchParams|request\.|req\.|headers\(\)|cookies\(\)|params/);
    expect(route).toMatch(/export async function GET\(\)/);
  });
});

describe("cadena de suministro y configuración", () => {
  it("todas las acciones de GitHub están fijadas por commit", () => {
    for (const file of readdirSync(join(root, ".github/workflows"))) {
      const uses = read(`.github/workflows/${file}`).match(/uses:\s*\S+/g) ?? [];
      for (const line of uses) {
        expect(line, `${file}: ${line}`).toMatch(/@[0-9a-f]{40}$/);
      }
    }
  });

  it("el flujo de Android usa el entorno protegido y no guarda credenciales", () => {
    const flow = read(".github/workflows/android.yml");
    expect(flow).toContain("environment: release");
    expect(flow).toContain("persist-credentials: false");
  });

  it("la app Android no admite HTTP ni copias de seguridad", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    const capacitor = read("capacitor.config.ts");
    expect(capacitor).toContain('url: "https://getappetito.vercel.app/app"');
    expect(capacitor).not.toMatch(/cleartext:\s*true/);
    expect(capacitor).toContain("webContentsDebuggingEnabled: false");
  });

  it("las cabeceras impiden incrustar la web y plugins ajenos", () => {
    const config = read("next.config.ts");
    for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
      expect(config).toContain(directive);
    }
    expect(config).toContain("X-Frame-Options");
  });

  it("no hay formas de ejecutar o inyectar HTML en el código de la app", () => {
    for (const file of appFiles()) {
      expect(read(file), file).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\(|new Function\(|document\.write/);
    }
  });

  it("no hay claves secretas en el repositorio", () => {
    for (const file of [...appFiles(), "capacitor.config.ts", "next.config.ts", ".env.example"]) {
      expect(read(file), file).not.toMatch(/sb_secret_|service_role|BEGIN (RSA |EC )?PRIVATE KEY|ghp_[A-Za-z0-9]{20}/);
    }
  });
});
