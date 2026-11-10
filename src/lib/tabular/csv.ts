/**
 * Lectura y escritura de CSV. Acepta coma o punto y coma (Excel en español usa «;»), comillas,
 * saltos de línea dentro de una celda y un BOM al inicio.
 */

/** Elige el separador mirando la primera línea: el más frecuente fuera de comillas. */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "\n") break;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  return (Object.keys(counts) as string[]).reduce((best, d) => (counts[d] > counts[best] ? d : best), ",");
}

/** Convierte texto CSV en filas de celdas. Las filas totalmente vacías se descartan. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) endCell();
    else if (ch === "\n") endRow();
    else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

/**
 * Convierte filas en texto CSV con «;» y BOM, para que Excel en español lo abra en columnas con las
 * tildes bien. Las celdas que parecen fórmula se neutralizan (inyección de fórmulas en Excel).
 */
export function toCsv(rows: (string | number | boolean)[][]): string {
  const escape = (value: string | number | boolean) => {
    let s = String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(escape).join(";")).join("\r\n") + "\r\n";
}
