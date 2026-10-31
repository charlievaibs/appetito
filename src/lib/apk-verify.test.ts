import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fetchVerifiedApk, MAX_APK_BYTES } from "./apk-verify";
import { apkSourceUrl } from "./release";

const good = new TextEncoder().encode("apk-oficial-de-prueba");
const release = { version: "1.2.3", sha256: createHash("sha256").update(good).digest("hex") };
const GITHUB = apkSourceUrl("1.2.3");

/** fetch falso que responde según la dirección pedida. */
function fakeFetch(routes: Record<string, () => Response>, seen: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input instanceof URL ? input.href : input);
    seen.push(url);
    const route = routes[url];
    return route ? route() : new Response("no existe", { status: 404 });
  }) as typeof fetch;
}

describe("fetchVerifiedApk", () => {
  it("entrega el archivo cuando la huella coincide", async () => {
    const result = await fetchVerifiedApk(release, fakeFetch({ [GITHUB]: () => new Response(good) }));
    expect(result).toEqual({ ok: true, bytes: good });
  });

  it("no hay versión publicada", async () => {
    expect(await fetchVerifiedApk(null)).toEqual({ ok: false, reason: "no-release" });
  });

  it("rechaza un archivo con un solo byte distinto", async () => {
    const tampered = new Uint8Array(good);
    tampered[0] ^= 1;
    const result = await fetchVerifiedApk(release, fakeFetch({ [GITHUB]: () => new Response(tampered) }));
    expect(result).toEqual({ ok: false, reason: "hash-mismatch" });
  });

  it("rechaza un archivo con bytes añadidos al final", async () => {
    const extended = new Uint8Array([...good, 0]);
    const result = await fetchVerifiedApk(release, fakeFetch({ [GITHUB]: () => new Response(extended) }));
    expect(result).toEqual({ ok: false, reason: "hash-mismatch" });
  });

  it("sigue redirecciones solo hacia el almacén de GitHub", async () => {
    const store = "https://release-assets.githubusercontent.com/abc/appetito.apk";
    const seen: string[] = [];
    const result = await fetchVerifiedApk(
      release,
      fakeFetch(
        {
          [GITHUB]: () => new Response(null, { status: 302, headers: { location: store } }),
          [store]: () => new Response(good),
        },
        seen,
      ),
    );
    expect(result.ok).toBe(true);
    expect(seen).toEqual([GITHUB, store]);
  });

  it.each([
    ["otro dominio", "https://evil.example.com/appetito.apk"],
    ["dominio parecido", "https://github.com.evil.example/appetito.apk"],
    ["subdominio engañoso", "https://objects.githubusercontent.com.evil.example/a.apk"],
    ["HTTP sin cifrar", "http://github.com/x/appetito.apk"],
    ["puerto raro", "https://github.com:8443/x.apk"],
    ["credenciales en la URL", "https://github.com@evil.example/a.apk"],
  ])("bloquea una redirección a %s", async (_name, target) => {
    const seen: string[] = [];
    const result = await fetchVerifiedApk(
      release,
      fakeFetch({ [GITHUB]: () => new Response(null, { status: 302, headers: { location: target } }) }, seen),
    );
    expect(result).toEqual({ ok: false, reason: "redirect" });
    expect(seen).toEqual([GITHUB]); // ni siquiera se llega a pedir al destino ajeno
  });

  it("corta un bucle de redirecciones", async () => {
    const result = await fetchVerifiedApk(
      release,
      fakeFetch({ [GITHUB]: () => new Response(null, { status: 302, headers: { location: GITHUB } }) }),
    );
    expect(result).toEqual({ ok: false, reason: "redirect" });
  });

  it("rechaza configuraciones manipuladas", async () => {
    for (const bad of [
      { version: "1.2.3/../../evil", sha256: release.sha256 },
      { version: "1.2.3?x=1", sha256: release.sha256 },
      { version: "1.2.3", sha256: "ABC" },
      { version: "1.2.3", sha256: release.sha256.toUpperCase() },
    ]) {
      expect(await fetchVerifiedApk(bad, fakeFetch({}))).toEqual({ ok: false, reason: "bad-config" });
    }
  });

  it("rechaza archivos enormes o vacíos", async () => {
    const huge = fakeFetch({
      [GITHUB]: () => new Response(good, { headers: { "content-length": String(MAX_APK_BYTES + 1) } }),
    });
    expect(await fetchVerifiedApk(release, huge)).toEqual({ ok: false, reason: "too-large" });
    const empty = fakeFetch({ [GITHUB]: () => new Response(new Uint8Array()) });
    expect(await fetchVerifiedApk(release, empty)).toEqual({ ok: false, reason: "too-large" });
  });

  it("no entrega nada si GitHub falla", async () => {
    expect(await fetchVerifiedApk(release, fakeFetch({}))).toEqual({ ok: false, reason: "upstream" });
    const down = (async () => {
      throw new Error("red caída");
    }) as typeof fetch;
    expect(await fetchVerifiedApk(release, down)).toEqual({ ok: false, reason: "upstream" });
  });
});
