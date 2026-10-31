// Crea la cuenta de un empleado y lo suma al equipo. Corre en Supabase (Edge Function): solo allí existe la clave
// de administración, que nunca llega al navegador. Solo dueño o gerente pueden llamarla, y solo para los roles
// que cada uno puede administrar (se comprueba en la base de datos con la sesión de quien llama).
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://getappetito.vercel.app", "http://localhost:3000"]);
const ROLES = ["manager", "host", "waiter", "kitchen", "cashier"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://getappetito.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function reply(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

/** Contraseña temporal aleatoria, sin caracteres confusos. La persona debe cambiarla al entrar. */
function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405, headers);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Quién llama: debe ser una cuenta real (no invitado).
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user || userData.user.is_anonymous) return reply({ error: "auth_required" }, 401, headers);

  // 2) Datos de entrada, validados.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "invalid_body" }, 400, headers);
  }
  const restaurantId = String(body.restaurant_id ?? "");
  const role = String(body.role ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim().slice(0, 60);
  if (!UUID.test(restaurantId) || !ROLES.includes(role) || !EMAIL.test(email) || email.length > 254) {
    return reply({ error: "invalid_input" }, 400, headers);
  }

  // 3) Permiso: lo decide la base de datos con la sesión de quien llama.
  const { data: allowed } = await caller.rpc("can_manage_role", { p_restaurant_id: restaurantId, p_role: role });
  if (allowed !== true) return reply({ error: "forbidden" }, 403, headers);

  // 4) Con la clave de administración (solo aquí) se crea la cuenta y se suma al equipo.
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const password = temporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { temp_password: true },
  });
  if (createError || !created.user) {
    const exists = /already|registered|exists/i.test(createError?.message ?? "");
    return reply({ error: exists ? "email_exists" : "create_failed" }, exists ? 409 : 500, headers);
  }

  const { error: memberError } = await admin
    .from("restaurant_members")
    .insert({ restaurant_id: restaurantId, user_id: created.user.id, role, display_name: name || null });
  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return reply({ error: "create_failed" }, 500, headers);
  }
  await admin.from("staff_events").insert({
    restaurant_id: restaurantId,
    actor: userData.user.id,
    target: created.user.id,
    action: "account_created",
    detail: { role },
  });

  // La contraseña solo se devuelve aquí, una vez, a quien la crea; no se guarda en ningún registro.
  return reply({ email, password }, 200, headers);
});
