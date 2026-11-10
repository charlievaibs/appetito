/**
 * Lectura y escritura mínima de archivos Excel (.xlsx) sin dependencias pesadas: un .xlsx es un zip
 * de XML, así que solo hace falta `fflate` para descomprimir. Se lee la primera hoja (texto y
 * números) y se escribe una hoja con una tabla simple. No se interpretan fórmulas ni fechas.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 40 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLS = 60;

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function encodeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "A" -> 0, "B" -> 1, "AA" -> 26. */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** 0 -> "A", 26 -> "AA". */
function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Junta todos los textos `<t>` de un fragmento (también los de texto con formato). */
function textOf(xml: string): string {
  let out = "";
  for (const m of xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += decodeXml(m[1]);
  return out;
}

/** Lee la primera hoja de un .xlsx como filas de texto. Lanza un Error con mensaje claro si no es válido. */
export function readXlsx(bytes: Uint8Array): string[][] {
  if (bytes.length > MAX_FILE_BYTES) throw new Error("El archivo es demasiado grande (máximo 10 MB)");

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      // Solo se descomprime lo necesario y nada que, ya descomprimido, sea desproporcionado (zip bomb).
      filter: (f) =>
        /^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(f.name) &&
        f.originalSize <= MAX_UNZIPPED_BYTES,
    });
  } catch {
    throw new Error("No se pudo leer el archivo: no parece un Excel (.xlsx) válido");
  }

  const sheetNames = Object.keys(files)
    .filter((n) => n.startsWith("xl/worksheets/"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (sheetNames.length === 0) throw new Error("El Excel no tiene hojas");

  // La primera hoja según el libro; si algo falla, la primera por nombre.
  let sheetPath = sheetNames[0];
  const workbook = files["xl/workbook.xml"] && strFromU8(files["xl/workbook.xml"]);
  const rels = files["xl/_rels/workbook.xml.rels"] && strFromU8(files["xl/_rels/workbook.xml.rels"]);
  if (workbook && rels) {
    const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
    if (rid) {
      for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
        if (m[0].includes(`Id="${rid}"`)) {
          const target = /Target="([^"]+)"/.exec(m[0])?.[1];
          const path = target && "xl/" + target.replace(/^\/?(xl\/)?/, "");
          if (path && files[path]) sheetPath = path;
        }
      }
    }
  }

  const shared: string[] = [];
  if (files["xl/sharedStrings.xml"]) {
    for (const m of strFromU8(files["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      shared.push(textOf(m[1]));
    }
  }

  const rows: string[][] = [];
  const sheet = strFromU8(files[sheetPath]);
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    if (rows.length >= MAX_ROWS) throw new Error(`El Excel tiene demasiadas filas (máximo ${MAX_ROWS})`);
    const cells: string[] = [];
    let next = 0;
    for (const c of (rowMatch[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /\br="([A-Z]+)\d+"/i.exec(attrs)?.[1];
      const col = ref ? columnIndex(ref) : next;
      if (col >= MAX_COLS) continue;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const body = c[2] ?? "";
      let value = "";
      if (type === "inlineStr") value = textOf(body);
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (v !== undefined) value = type === "s" ? (shared[Number(v)] ?? "") : decodeXml(v);
      }
      while (cells.length < col) cells.push("");
      cells[col] = value;
      next = col + 1;
    }
    if (cells.some((v) => v.trim() !== "")) rows.push(cells);
  }
  return rows;
}

/** Crea un .xlsx con una hoja. Los números salen como números y el resto como texto. */
export function writeXlsx(rows: (string | number | boolean)[][], sheetName = "Hoja1"): Uint8Array {
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${columnName(c)}${r + 1}`;
          if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${encodeXml(String(value))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");

  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      xml +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      xml +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    ),
    "xl/workbook.xml": strToU8(
      xml +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${encodeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      xml +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        "</Relationships>",
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      xml +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  };
  return zipSync(files);
}
