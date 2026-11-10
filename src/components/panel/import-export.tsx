"use client";

import { useRef, useState } from "react";
import { describeError } from "@/lib/errors";
import { useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import {
  buildSheet,
  checkImportRow,
  FIELDS,
  importRowKey,
  parseImportTable,
  templateSheet,
  type ImportKind,
  type ImportRow,
} from "@/lib/tabular/columns";
import { downloadSheet, readTableFile } from "@/lib/tabular/file";
import { cardClass, primaryButton, secondaryButton, smallButton } from "./styles";

const CHUNK = 500;
const TITLE: Record<ImportKind, string> = { menu: "menu", inventory: "inventario" };

type Preview = {
  fileName: string;
  rows: ImportRow[];
  problems: { row: number; message: string }[];
  ignoredColumns: string[];
  created: number;
  updated: number;
};

type Outcome = { created: number; updated: number; errors: { row: number; message: string }[] };

/**
 * Importar y exportar el menú o el inventario con archivos Excel (.xlsx) o CSV. Primero se muestra una
 * vista previa (qué se crea, qué se actualiza, qué filas tienen problemas) y solo al confirmar se envía.
 * Una celda vacía no cambia el dato; las filas con problemas se omiten y el resto se importa.
 */
export function ImportExport({
  kind,
  existingKeys,
  exportRows,
  onImported,
}: {
  kind: ImportKind;
  /** Claves (código o sku) que ya existen, para distinguir crear de actualizar en la vista previa. */
  existingKeys: Set<string>;
  /** Filas de datos para exportar, en el orden de las columnas de la plantilla. */
  exportRows: () => (string | number | boolean)[][];
  onImported: () => void;
}) {
  const restaurant = useRestaurant();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function chooseFile(file: File) {
    setError(null);
    setOutcome(null);
    setPreview(null);
    try {
      const parsed = parseImportTable(kind, await readTableFile(file));
      if (parsed.fatal) {
        setError(parsed.fatal);
        return;
      }
      const problems = parsed.rows.flatMap((row, i) => {
        const message = checkImportRow(kind, row);
        return message ? [{ row: i + 2, message }] : [];
      });
      const bad = new Set(problems.map((p) => p.row));
      let created = 0;
      let updated = 0;
      parsed.rows.forEach((row, i) => {
        if (bad.has(i + 2)) return;
        if (existingKeys.has(importRowKey(kind, row))) updated++;
        else created++;
      });
      setPreview({ fileName: file.name, rows: parsed.rows, problems, ignoredColumns: parsed.ignoredColumns, created, updated });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo");
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    const bad = new Set(preview.problems.map((p) => p.row));
    // El número de fila que ve la persona es el de su archivo (la fila 1 son los encabezados).
    const valid = preview.rows.map((row, i) => ({ row, line: i + 2 })).filter((r) => !bad.has(r.line));
    const total: Outcome = { created: 0, updated: 0, errors: [] };
    try {
      for (let start = 0; start < valid.length; start += CHUNK) {
        const chunk = valid.slice(start, start + CHUNK);
        const rows = chunk.map((c) => c.row);
        const supabase = getSupabase();
        const { data, error } =
          kind === "menu"
            ? await supabase.rpc("import_menu", { p_restaurant_id: restaurant.id, p_rows: rows })
            : await supabase.rpc("import_inventory", { p_restaurant_id: restaurant.id, p_rows: rows });
        if (error) throw new Error(error.message);
        const result = data as Outcome;
        total.created += result.created;
        total.updated += result.updated;
        // Los números de fila del servidor son relativos al bloque: se traducen a la línea del archivo.
        total.errors.push(...result.errors.map((e) => ({ row: chunk[e.row - 1]?.line ?? e.row, message: e.message })));
      }
      setOutcome({ ...total, errors: [...total.errors, ...preview.problems] });
      setPreview(null);
      onImported();
    } catch (e) {
      setError(describeError(e instanceof Error ? e.message : "No se pudo importar"));
    } finally {
      setBusy(false);
    }
  }

  const exportName = `appetito-${TITLE[kind]}`;
  const columns = FIELDS[kind].map((f) => f.header).join(", ");

  return (
    <div className={`${cardClass} mb-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Importar y exportar</h2>
          <p className="text-sm text-muted">Carga o actualiza todo de una vez con Excel o CSV.</p>
        </div>
        <button type="button" className={smallButton} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Ocultar" : "Abrir"}
        </button>
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButton} onClick={() => input.current?.click()}>
              Elegir archivo (.xlsx / .csv)
            </button>
            <button type="button" className={smallButton} onClick={() => downloadSheet(exportName, buildSheet(kind, exportRows()), "xlsx")}>
              Exportar Excel
            </button>
            <button type="button" className={smallButton} onClick={() => downloadSheet(exportName, buildSheet(kind, exportRows()), "csv")}>
              Exportar CSV
            </button>
            <button type="button" className={smallButton} onClick={() => downloadSheet(`plantilla-${TITLE[kind]}`, templateSheet(kind), "xlsx")}>
              Plantilla Excel
            </button>
            <input
              ref={input}
              type="file"
              accept=".xlsx,.csv,.txt,text/csv"
              className="sr-only"
              aria-label="Archivo a importar"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void chooseFile(file);
              }}
            />
          </div>

          <p className="text-xs text-muted">
            Columnas: {columns}. {kind === "menu" ? "Los precios van sin IVA. " : "El costo va sin IVA. "}
            Se reconoce por el código{kind === "menu" ? "" : " (sku)"} o, si falta, por el nombre; una celda vacía no cambia ese dato.
          </p>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          {preview && (
            <div className="rounded-xl border border-line p-4">
              <p className="font-semibold">{preview.fileName}</p>
              <p className="text-sm">
                Se crearán <strong>{preview.created}</strong> y se actualizarán <strong>{preview.updated}</strong>.
                {preview.problems.length > 0 && (
                  <span className="text-red-600"> {preview.problems.length} fila(s) con problemas se omitirán.</span>
                )}
              </p>
              {preview.ignoredColumns.length > 0 && (
                <p className="text-xs text-muted">Columnas ignoradas: {preview.ignoredColumns.join(", ")}</p>
              )}
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-muted">
                      {FIELDS[kind].map((f) => (
                        <th key={f.key} className="pr-3 font-medium">
                          {f.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 8).map((row, i) => (
                      <tr key={i} className="border-t border-line">
                        {FIELDS[kind].map((f) => (
                          <td key={f.key} className="max-w-48 truncate py-1 pr-3">
                            {row[f.key] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 8 && <p className="text-xs text-muted">… y {preview.rows.length - 8} más</p>}
              </div>
              <ProblemList problems={preview.problems} />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className={primaryButton}
                  disabled={busy || preview.created + preview.updated === 0}
                  onClick={() => void confirm()}
                >
                  {busy ? "Importando…" : `Importar ${preview.created + preview.updated} fila(s)`}
                </button>
                <button type="button" className={secondaryButton} disabled={busy} onClick={() => setPreview(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {outcome && (
            <div role="status" className="rounded-xl border border-line p-4">
              <p className="font-semibold">
                Listo: {outcome.created} creados, {outcome.updated} actualizados
                {outcome.errors.length > 0 && `, ${outcome.errors.length} con problemas`}.
              </p>
              <ProblemList problems={outcome.errors} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProblemList({ problems }: { problems: { row: number; message: string }[] }) {
  if (problems.length === 0) return null;
  return (
    <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-sm text-red-600">
      {problems.slice(0, 50).map((p, i) => (
        <li key={i}>
          Fila {p.row}: {p.message}
        </li>
      ))}
      {problems.length > 50 && <li>… y {problems.length - 50} más</li>}
    </ul>
  );
}
