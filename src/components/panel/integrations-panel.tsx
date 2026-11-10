"use client";

import { useCallback, useState, type FormEvent } from "react";
import { describeError } from "@/lib/errors";
import { useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, inputClass, primaryButton, secondaryButton, smallButton } from "./styles";

/**
 * Integraciones: claves de API para conectar otros sistemas (caja, ERP, Excel, Power BI) al menú y al
 * inventario. La clave se muestra una sola vez; en la base solo queda su huella.
 */
export function IntegrationsPanel() {
  const restaurant = useRestaurant();
  const [name, setName] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loader = useCallback(
    async () =>
      unwrap(
        await getSupabase()
          .from("api_keys")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false }),
      ),
    [restaurant.id],
  );
  const { data: keys, error: loadError, reload } = useAsyncLoad(loader);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCopied(false);
    const { data, error } = await getSupabase().rpc("create_api_key", {
      p_restaurant_id: restaurant.id,
      p_name: name.trim(),
      p_can_write: canWrite,
    });
    setBusy(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    setNewKey(data);
    setName("");
    setCanWrite(false);
    await reload();
  }

  async function revoke(id: string, label: string) {
    if (!window.confirm(`¿Revocar la clave "${label}"? Lo que la use dejará de funcionar de inmediato.`)) return;
    const { error } = await getSupabase().rpc("revoke_api_key", { p_key_id: id });
    setError(error ? describeError(error.message) : null);
    await reload();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const origin = typeof window === "undefined" ? "https://tu-dominio" : window.location.origin;
  const shownError = error ?? loadError;
  const keyHint = newKey ?? "apt_TU_CLAVE";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-sm text-muted">
          Conecta tu caja, tu ERP, Excel o Power BI con el menú y el inventario de {restaurant.name}.
        </p>
      </div>

      {shownError && (
        <p role="alert" className="text-sm text-red-600">
          {shownError}
        </p>
      )}

      <section className={cardClass} aria-labelledby="keys-title">
        <h2 id="keys-title" className="font-semibold">
          Claves de API
        </h2>
        <p className="mb-3 text-sm text-muted">
          Cada sistema debe tener su propia clave, así puedes revocar una sin afectar a las demás. Las claves de solo
          lectura no pueden cambiar nada.
        </p>

        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="text-sm font-medium" htmlFor="key-name">
              Nombre (qué la usará)
            </label>
            <input
              id="key-name"
              required
              maxLength={60}
              placeholder="Excel de compras"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 pb-3 text-sm font-medium">
            <input type="checkbox" checked={canWrite} onChange={(e) => setCanWrite(e.target.checked)} className="size-5" />
            Puede modificar datos
          </label>
          <button type="submit" disabled={busy} className={primaryButton}>
            Crear clave
          </button>
        </form>

        {newKey && (
          <div role="status" className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
            <p className="font-semibold">Copia tu clave ahora: no se volverá a mostrar</p>
            <code className="mt-2 block break-all rounded-lg bg-card p-3 text-sm">{newKey}</code>
            <div className="mt-2 flex gap-2">
              <button type="button" className={smallButton} onClick={() => void copy(newKey)}>
                {copied ? "Copiada ✓" : "Copiar"}
              </button>
              <button type="button" className={secondaryButton} onClick={() => setNewKey(null)}>
                Ya la guardé
              </button>
            </div>
          </div>
        )}

        <ul className="mt-4 flex flex-col gap-2">
          {keys?.length === 0 && <li className="text-sm text-muted">Todavía no hay claves.</li>}
          {keys?.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
              <div>
                <p className={`font-medium ${k.revoked_at ? "text-muted line-through" : ""}`}>{k.name}</p>
                <p className="text-xs text-muted">
                  {k.prefix}… · {k.can_write ? "lee y modifica" : "solo lectura"} ·{" "}
                  {k.last_used_at ? `usada ${new Date(k.last_used_at).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}` : "sin usar"}
                  {k.revoked_at && " · revocada"}
                </p>
              </div>
              {!k.revoked_at && (
                <button type="button" className={`${smallButton} text-red-600`} onClick={() => void revoke(k.id, k.name)}>
                  Revocar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={cardClass} aria-labelledby="excel-title">
        <h2 id="excel-title" className="font-semibold">
          Excel, Power BI y Google Sheets (OData)
        </h2>
        <p className="mb-2 text-sm text-muted">
          Solo lectura, siempre al día. En Excel: Datos → Obtener datos → De otras fuentes → De fuente OData. Pega la dirección,
          elige «Básica» y escribe cualquier usuario y la clave como contraseña.
        </p>
        <Code>{`${origin}/api/v1/odata`}</Code>
        <p className="mt-2 text-sm text-muted">
          Conjuntos: <code>Dishes</code> (menú) e <code>InventoryItems</code> (inventario). Admite $filter, $orderby, $select,
          $top, $skip y $count, por ejemplo <code>InventoryItems?$filter=low_stock eq true</code>.
        </p>
      </section>

      <section className={cardClass} aria-labelledby="rest-title">
        <h2 id="rest-title" className="font-semibold">
          API REST (JSON)
        </h2>
        <p className="mb-2 text-sm text-muted">
          Envía la clave en la cabecera <code>Authorization: Bearer</code>. Precios y costos van como números decimales{" "}
          <strong>sin IVA</strong>. Cada llamada de escritura acepta hasta 2000 filas; una fila con error no afecta a las demás
          y el resultado indica cuáles fallaron. Solo cambian los campos que envíes.
        </p>
        <div className="flex flex-col gap-3">
          <Code>{`curl ${origin}/api/v1/menu \\\n  -H "Authorization: Bearer ${keyHint}"`}</Code>
          <Code>{`curl -X POST ${origin}/api/v1/menu \\\n  -H "Authorization: Bearer ${keyHint}" \\\n  -H "Content-Type: application/json" \\\n  -d '[{"code":"arepa","name":"Arepa","category":"Platos","price":3.5,"available":true}]'`}</Code>
          <Code>{`curl -X POST ${origin}/api/v1/inventory \\\n  -H "Authorization: Bearer ${keyHint}" \\\n  -H "Content-Type: application/json" \\\n  -d '[{"sku":"harina","name":"Harina de maíz","unit":"kg","stock":25,"min_stock":5,"cost":1.8}]'`}</Code>
          <Code>{`curl -X POST ${origin}/api/v1/inventory/adjust \\\n  -H "Authorization: Bearer ${keyHint}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"sku":"harina","delta":-2.5,"reason":"consumo","note":"producción del día"}'`}</Code>
        </div>
        <ul className="mt-3 list-disc pl-5 text-sm text-muted">
          <li>
            Menú: <code>code, name, category, price, description, emoji, available</code>
          </li>
          <li>
            Inventario: <code>sku, name, category, unit (u, kg, g, l, ml), stock, min_stock, cost, active</code>
          </li>
          <li>
            Motivos de <code>adjust</code>: compra, merma, ajuste, consumo
          </li>
        </ul>
      </section>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}
