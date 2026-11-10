/**
 * Columnas de las importaciones (menú e inventario): nombres aceptados en el archivo, validación
 * ligera antes de enviar y filas de plantilla/exportación. La validación definitiva la hace la base de
 * datos; aquí solo se evita mandar basura y se muestra una vista previa útil.
 */
import { slugify } from "../slug";

export type ImportKind = "menu" | "inventory";

type Field = {
  /** Nombre del campo que entiende la base de datos. */
  key: string;
  /** Encabezado con el que se exporta y se escribe en la plantilla. */
  header: string;
  aliases: string[];
  type?: "number" | "boolean";
};

/** Encabezado -> forma comparable: sin tildes ni mayúsculas, símbolos como «_». */
export function normalizeHeader(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const FIELDS: Record<ImportKind, Field[]> = {
  menu: [
    { key: "code", header: "codigo", aliases: ["codigo", "code", "id", "sku", "slug", "referencia"] },
    { key: "name", header: "nombre", aliases: ["nombre", "name", "plato", "producto", "articulo", "item"] },
    { key: "category", header: "categoria", aliases: ["categoria", "category", "rubro", "grupo", "seccion"] },
    {
      key: "price",
      header: "precio",
      aliases: ["precio", "price", "precio_sin_iva", "precio_base", "monto", "pvp"],
      type: "number",
    },
    { key: "description", header: "descripcion", aliases: ["descripcion", "description", "detalle", "ingredientes"] },
    { key: "emoji", header: "emoji", aliases: ["emoji", "icono"] },
    {
      key: "available",
      header: "disponible",
      aliases: ["disponible", "available", "activo", "estado"],
      type: "boolean",
    },
  ],
  inventory: [
    { key: "sku", header: "sku", aliases: ["sku", "codigo", "code", "id", "referencia"] },
    { key: "name", header: "nombre", aliases: ["nombre", "name", "producto", "articulo", "insumo", "item"] },
    { key: "category", header: "categoria", aliases: ["categoria", "category", "rubro", "grupo", "seccion"] },
    { key: "unit", header: "unidad", aliases: ["unidad", "unit", "um", "medida"] },
    {
      key: "stock",
      header: "stock",
      aliases: ["stock", "existencia", "existencias", "cantidad", "qty", "inventario"],
      type: "number",
    },
    {
      key: "min_stock",
      header: "stock_minimo",
      aliases: ["stock_minimo", "minimo", "min", "min_stock", "reorden", "punto_de_reorden"],
      type: "number",
    },
    {
      key: "cost",
      header: "costo",
      aliases: ["costo", "cost", "costo_unitario", "precio_de_compra", "precio_compra"],
      type: "number",
    },
    { key: "active", header: "activo", aliases: ["activo", "active", "estado"], type: "boolean" },
  ],
};

/** Identificadores aceptados para reconocer una fila existente. */
const KEY_FIELDS: Record<ImportKind, [string, string]> = {
  menu: ["code", "name"],
  inventory: ["sku", "name"],
};

export type ImportRow = Record<string, string>;

export type ParsedImport = {
  rows: ImportRow[];
  /** Columnas del archivo que no se reconocieron (se ignoran). */
  ignoredColumns: string[];
  /** Si no hay forma de identificar las filas, el motivo; si no, null. */
  fatal: string | null;
};

export const MAX_IMPORT_ROWS = 2000;

/** Convierte una tabla de celdas (primera fila = encabezados) en filas con los nombres de campo de la base. */
export function parseImportTable(kind: ImportKind, table: string[][]): ParsedImport {
  const fields = FIELDS[kind];
  if (table.length < 2) return { rows: [], ignoredColumns: [], fatal: "El archivo no tiene filas de datos" };

  const headers = table[0].map(normalizeHeader);
  const columnField = headers.map((h) => fields.find((f) => f.aliases.includes(h))?.key ?? null);
  const ignoredColumns = table[0].filter((_, i) => columnField[i] === null && table[0][i].trim() !== "");

  const [primary, secondary] = KEY_FIELDS[kind];
  if (!columnField.includes(primary) && !columnField.includes(secondary)) {
    return {
      rows: [],
      ignoredColumns,
      fatal: `Falta una columna para identificar cada fila: «${fields.find((f) => f.key === primary)?.header}» o «nombre»`,
    };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], ignoredColumns, fatal: `Demasiadas filas (máximo ${MAX_IMPORT_ROWS} por archivo)` };
  }

  const rows = table.slice(1).map((cells) => {
    const row: ImportRow = {};
    columnField.forEach((key, i) => {
      const value = cells[i]?.trim();
      // Una celda vacía significa «no cambiar este dato».
      if (key && value) row[key] = value;
    });
    return row;
  });
  return { rows, ignoredColumns, fatal: null };
}

const NUMBER = /^-?\d+([.,]\d+)?$/;
const YES = ["true", "t", "1", "si", "sí", "yes", "y", "activo", "disponible"];
const NO = ["false", "f", "0", "no", "n", "inactivo", "agotado", "pausado"];

/** Problema de una fila (número o sí/no mal escrito, identificador vacío), o null si está bien. */
export function checkImportRow(kind: ImportKind, row: ImportRow): string | null {
  const [primary, secondary] = KEY_FIELDS[kind];
  if (!slugify(row[primary] ?? "") && !slugify(row[secondary] ?? "")) return "Falta el nombre o el código";
  for (const field of FIELDS[kind]) {
    const value = row[field.key];
    if (value === undefined) continue;
    if (field.type === "number" && !NUMBER.test(value)) return `«${field.header}» no es un número: ${value}`;
    if (field.type === "boolean" && ![...YES, ...NO].includes(value.toLowerCase())) {
      return `«${field.header}» debe ser sí o no: ${value}`;
    }
  }
  return null;
}

/** Clave con la que la base reconoce la fila (igual que en SQL: código o, si falta, nombre). */
export function importRowKey(kind: ImportKind, row: ImportRow): string {
  const [primary, secondary] = KEY_FIELDS[kind];
  return slugify(row[primary] ?? "") || slugify(row[secondary] ?? "");
}

/** Encabezados + filas para exportar o usar de plantilla. */
export function buildSheet(kind: ImportKind, data: (string | number | boolean)[][]): (string | number | boolean)[][] {
  return [FIELDS[kind].map((f) => f.header), ...data];
}

export function templateSheet(kind: ImportKind): (string | number | boolean)[][] {
  return buildSheet(
    kind,
    kind === "menu"
      ? [
          ["hamburguesa", "Hamburguesa clásica", "Platos", 8.5, "Carne, queso y vegetales", "🍔", "si"],
          ["limonada", "Limonada", "Bebidas", 2, "", "🍋", "si"],
        ]
      : [
          ["carne-molida", "Carne molida", "Carnes", "kg", 12.5, 5, 6.8, "si"],
          ["pan-hamburguesa", "Pan de hamburguesa", "Panadería", "u", 80, 30, 0.25, "si"],
        ],
  );
}
