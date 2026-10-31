/**
 * Prueba de ataque con un APK REAL. Se omite salvo que APPETITO_TEST_APK apunte a un
 * archivo (por ejemplo el APK que produce el flujo de Android):
 *   APPETITO_TEST_APK=ruta/app-release.apk npx vitest run src/lib/apk-verify.apk.test.ts
 * Comprueba que la descarga verificada acepta el original y rechaza cualquier alteración.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchVerifiedApk } from "./apk-verify";
import { apkSourceUrl } from "./release";

const path = process.env.APPETITO_TEST_APK;
const URL_ = apkSourceUrl("1.0.0");

function serving(bytes: Uint8Array): typeof fetch {
  return (async () => new Response(bytes as BodyInit)) as typeof fetch;
}

describe.skipIf(!path)("APK real", () => {
  // describe.skipIf igualmente ejecuta este cuerpo: solo se lee el archivo si existe la ruta.
  const original = path ? new Uint8Array(readFileSync(path)) : new Uint8Array();
  const release = { version: "1.0.0", sha256: createHash("sha256").update(original).digest("hex") };

  it("acepta el original", async () => {
    expect((await fetchVerifiedApk(release, serving(original))).ok).toBe(true);
    expect(URL_).toContain("/releases/download/v1.0.0/appetito.apk");
  });

  it("rechaza un bit cambiado en cualquier zona del archivo", async () => {
    const positions = [0, 1, 100, Math.floor(original.length / 2), original.length - 22, original.length - 1];
    for (const position of positions) {
      const tampered = new Uint8Array(original);
      tampered[position] ^= 0x01;
      expect(await fetchVerifiedApk(release, serving(tampered)), `byte ${position}`).toEqual({
        ok: false,
        reason: "hash-mismatch",
      });
    }
  });

  it("rechaza datos añadidos (técnica habitual para inyectar código en un zip)", async () => {
    const extended = new Uint8Array(original.length + 1024);
    extended.set(original);
    expect(await fetchVerifiedApk(release, serving(extended))).toEqual({ ok: false, reason: "hash-mismatch" });
  });

  it("rechaza un archivo truncado o reemplazado por otro", async () => {
    expect((await fetchVerifiedApk(release, serving(original.slice(0, -10)))).ok).toBe(false);
    const other = new TextEncoder().encode("PK\u0003\u0004 apk malicioso");
    expect((await fetchVerifiedApk(release, serving(other))).ok).toBe(false);
  });
});
