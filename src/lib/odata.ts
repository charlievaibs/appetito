/**
 * OData v4 mínimo (solo lectura) para conectar Excel, Power BI o Google Sheets al menú y al inventario.
 * Soporta $filter, $orderby, $select, $top, $skip y $count. Todo se resuelve en memoria sobre las
 * filas que devuelve la base (como mucho unos miles), sin construir SQL a partir del texto recibido.
 */

export type EdmType = "Edm.String" | "Edm.Decimal" | "Edm.Boolean" | "Edm.DateTimeOffset";

export type Entity = {
  /** Nombre del conjunto de entidades en la URL. */
  name: string;
  singular: string;
  key: string;
  fields: Record<string, EdmType>;
  /** Función de la base que devuelve las filas. */
  rpc: "api_menu_list" | "api_inventory_list";
};

export const ENTITIES: Entity[] = [
  {
    name: "Dishes",
    singular: "Dish",
    key: "code",
    rpc: "api_menu_list",
    fields: {
      code: "Edm.String",
      name: "Edm.String",
      category: "Edm.String",
      price: "Edm.Decimal",
      description: "Edm.String",
      emoji: "Edm.String",
      available: "Edm.Boolean",
    },
  },
  {
    name: "InventoryItems",
    singular: "InventoryItem",
    key: "sku",
    rpc: "api_inventory_list",
    fields: {
      sku: "Edm.String",
      name: "Edm.String",
      category: "Edm.String",
      unit: "Edm.String",
      stock: "Edm.Decimal",
      min_stock: "Edm.Decimal",
      cost: "Edm.Decimal",
      active: "Edm.Boolean",
      low_stock: "Edm.Boolean",
      updated_at: "Edm.DateTimeOffset",
    },
  },
];

export class ODataError extends Error {}

type Value = string | number | boolean | null;
type Row = Record<string, unknown>;

// ---------------------------------------------------------------- $filter
type Token = { kind: "num" | "str" | "id" | "op"; text: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) i++;
    else if (ch === "'") {
      let text = "";
      i++;
      for (;;) {
        if (i >= input.length) throw new ODataError("Texto sin cerrar en $filter");
        if (input[i] === "'" && input[i + 1] === "'") {
          text += "'";
          i += 2;
        } else if (input[i] === "'") {
          i++;
          break;
        } else text += input[i++];
      }
      tokens.push({ kind: "str", text });
    } else if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(input[i + 1] ?? ""))) {
      const m = /^-?\d+(\.\d+)?/.exec(input.slice(i))!;
      tokens.push({ kind: "num", text: m[0] });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(i))!;
      tokens.push({ kind: "id", text: m[0] });
      i += m[0].length;
    } else if (ch === "(" || ch === ")" || ch === ",") {
      tokens.push({ kind: "op", text: ch });
      i++;
    } else throw new ODataError(`Carácter no válido en $filter: ${ch}`);
  }
  return tokens;
}

type Node =
  | { t: "lit"; v: Value }
  | { t: "field"; name: string }
  | { t: "call"; fn: string; args: Node[] }
  | { t: "bin"; op: string; l: Node; r: Node }
  | { t: "not"; x: Node };

const COMPARE = ["eq", "ne", "gt", "ge", "lt", "le"];
const FUNCTIONS: Record<string, number> = { contains: 2, startswith: 2, endswith: 2, tolower: 1, toupper: 1, length: 1 };
const MAX_DEPTH = 20;

function parseFilter(input: string, fields: Set<string>): Node {
  const tokens = tokenize(input);
  let pos = 0;
  const peek = () => tokens[pos];
  const isWord = (w: string) => peek()?.kind === "id" && peek().text === w;
  const isOp = (o: string) => peek()?.kind === "op" && peek().text === o;
  const expectOp = (o: string) => {
    if (!isOp(o)) throw new ODataError(`Se esperaba «${o}» en $filter`);
    pos++;
  };

  const parseOr = (depth: number): Node => {
    if (depth > MAX_DEPTH) throw new ODataError("$filter demasiado anidado");
    let left = parseAnd(depth);
    while (isWord("or")) {
      pos++;
      left = { t: "bin", op: "or", l: left, r: parseAnd(depth) };
    }
    return left;
  };
  const parseAnd = (depth: number): Node => {
    let left = parseNot(depth);
    while (isWord("and")) {
      pos++;
      left = { t: "bin", op: "and", l: left, r: parseNot(depth) };
    }
    return left;
  };
  const parseNot = (depth: number): Node => {
    if (isWord("not")) {
      pos++;
      return { t: "not", x: parseNot(depth) };
    }
    const left = parseValue(depth);
    const op = peek();
    if (op?.kind === "id" && COMPARE.includes(op.text)) {
      pos++;
      return { t: "bin", op: op.text, l: left, r: parseValue(depth) };
    }
    return left;
  };
  const parseValue = (depth: number): Node => {
    const tok = peek();
    if (!tok) throw new ODataError("$filter incompleto");
    pos++;
    if (tok.kind === "str") return { t: "lit", v: tok.text };
    if (tok.kind === "num") return { t: "lit", v: Number(tok.text) };
    if (tok.kind === "op" && tok.text === "(") {
      const inner = parseOr(depth + 1);
      expectOp(")");
      return inner;
    }
    if (tok.kind === "id") {
      if (tok.text === "true" || tok.text === "false") return { t: "lit", v: tok.text === "true" };
      if (tok.text === "null") return { t: "lit", v: null };
      if (isOp("(")) {
        const arity = FUNCTIONS[tok.text];
        if (arity === undefined) throw new ODataError(`Función no soportada: ${tok.text}`);
        pos++;
        const args: Node[] = [];
        for (;;) {
          args.push(parseOr(depth + 1));
          if (isOp(",")) pos++;
          else break;
        }
        expectOp(")");
        if (args.length !== arity) throw new ODataError(`${tok.text} espera ${arity} argumento(s)`);
        return { t: "call", fn: tok.text, args };
      }
      if (!fields.has(tok.text)) throw new ODataError(`Campo desconocido en $filter: ${tok.text}`);
      return { t: "field", name: tok.text };
    }
    throw new ODataError("$filter no válido");
  };

  const node = parseOr(0);
  if (pos < tokens.length) throw new ODataError("$filter no válido: sobra texto al final");
  return node;
}

function evaluate(node: Node, row: Row): Value {
  switch (node.t) {
    case "lit":
      return node.v;
    case "field": {
      const v = row[node.name];
      return v === undefined ? null : (v as Value);
    }
    case "not":
      return !evaluate(node.x, row);
    case "call": {
      const [a, b] = node.args.map((n) => evaluate(n, row));
      const s = a === null ? "" : String(a);
      switch (node.fn) {
        case "contains":
          return s.includes(String(b ?? ""));
        case "startswith":
          return s.startsWith(String(b ?? ""));
        case "endswith":
          return s.endsWith(String(b ?? ""));
        case "tolower":
          return s.toLowerCase();
        case "toupper":
          return s.toUpperCase();
        default:
          return s.length;
      }
    }
    case "bin": {
      if (node.op === "and") return Boolean(evaluate(node.l, row)) && Boolean(evaluate(node.r, row));
      if (node.op === "or") return Boolean(evaluate(node.l, row)) || Boolean(evaluate(node.r, row));
      const l = evaluate(node.l, row);
      const r = evaluate(node.r, row);
      if (node.op === "eq") return l === r;
      if (node.op === "ne") return l !== r;
      if (l === null || r === null) return false;
      const cmp = l < r ? -1 : l > r ? 1 : 0;
      return { gt: cmp > 0, ge: cmp >= 0, lt: cmp < 0, le: cmp <= 0 }[node.op] ?? false;
    }
  }
}

// ---------------------------------------------------------------- consulta completa
export type QueryResult = { value: Row[]; count: number };

function intParam(params: URLSearchParams, name: string, max: number): number | null {
  const raw = params.get(name);
  if (raw === null) return null;
  if (!/^\d+$/.test(raw)) throw new ODataError(`${name} debe ser un entero`);
  return Math.min(Number(raw), max);
}

/** Aplica las opciones de consulta OData a las filas. Lanza `ODataError` si algo no es válido. */
export function runQuery(entity: Entity, rows: Row[], params: URLSearchParams): QueryResult {
  const fields = new Set(Object.keys(entity.fields));
  let result = rows;

  const filter = params.get("$filter");
  if (filter) {
    const ast = parseFilter(filter, fields);
    result = result.filter((row) => Boolean(evaluate(ast, row)));
  }
  const count = result.length;

  const orderby = params.get("$orderby");
  if (orderby) {
    const keys = orderby.split(",").map((part) => {
      const [name, dir = "asc", extra] = part.trim().split(/\s+/);
      if (!fields.has(name) || extra !== undefined || !["asc", "desc"].includes(dir)) {
        throw new ODataError(`$orderby no válido: ${part.trim()}`);
      }
      return { name, sign: dir === "desc" ? -1 : 1 };
    });
    result = [...result].sort((a, b) => {
      for (const { name, sign } of keys) {
        const x = a[name] as Value;
        const y = b[name] as Value;
        if (x === y) continue;
        if (x === null) return -sign;
        if (y === null) return sign;
        return (x < y ? -1 : 1) * sign;
      }
      return 0;
    });
  }

  const skip = intParam(params, "$skip", Number.MAX_SAFE_INTEGER) ?? 0;
  const top = intParam(params, "$top", 5000);
  result = result.slice(skip, top === null ? undefined : skip + top);

  const select = params.get("$select");
  if (select && select.trim() !== "*") {
    const names = select.split(",").map((s) => s.trim());
    const unknown = names.find((n) => !fields.has(n));
    if (unknown) throw new ODataError(`$select: campo desconocido ${unknown}`);
    result = result.map((row) => Object.fromEntries(names.map((n) => [n, row[n]])));
  }
  return { value: result, count };
}

// ---------------------------------------------------------------- metadatos
function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Documento $metadata (EDMX 4.0) que Excel y Power BI piden antes de leer datos. */
export function metadataXml(): string {
  const types = ENTITIES.map(
    (e) =>
      `<EntityType Name="${e.singular}"><Key><PropertyRef Name="${e.key}"/></Key>` +
      Object.entries(e.fields)
        .map(([name, type]) => `<Property Name="${name}" Type="${type}" Nullable="${name === e.key ? "false" : "true"}"/>`)
        .join("") +
      "</EntityType>",
  ).join("");
  const sets = ENTITIES.map(
    (e) => `<EntitySet Name="${escapeXml(e.name)}" EntityType="Appetito.${e.singular}"/>`,
  ).join("");
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">' +
    '<edmx:DataServices><Schema Namespace="Appetito" xmlns="http://docs.oasis-open.org/odata/ns/edm">' +
    types +
    `<EntityContainer Name="Container">${sets}</EntityContainer>` +
    "</Schema></edmx:DataServices></edmx:Edmx>"
  );
}
