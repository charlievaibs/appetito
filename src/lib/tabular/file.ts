/** Lectura y descarga de archivos de tabla en el navegador (CSV y Excel). */
import { parseCsv, toCsv } from "./csv";
import { readXlsx, writeXlsx } from "./xlsx";

const MAX_BYTES = 10 * 1024 * 1024;

/** Lee un .csv/.txt/.xlsx elegido por la persona y devuelve sus filas de texto. */
export async function readTableFile(file: File): Promise<string[][]> {
  if (file.size > MAX_BYTES) throw new Error("El archivo es demasiado grande (máximo 10 MB)");
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Un .xlsx es un zip: empieza por «PK». Se detecta por contenido, no solo por la extensión.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes);
  if (/\.xls$/i.test(file.name)) throw new Error("Guarda el archivo como .xlsx o .csv (el formato .xls antiguo no se puede leer)");

  let text = new TextDecoder("utf-8").decode(bytes);
  // CSV guardado por Excel antiguo: Windows-1252 en vez de UTF-8.
  if (text.includes("�")) text = new TextDecoder("windows-1252").decode(bytes);
  return parseCsv(text);
}

function save(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSheet(
  name: string,
  rows: (string | number | boolean)[][],
  format: "xlsx" | "csv",
): void {
  if (format === "xlsx") {
    const bytes = writeXlsx(rows, name);
    save(`${name}.xlsx`, bytes as BlobPart, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  } else {
    save(`${name}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  }
}
