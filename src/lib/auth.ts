/**
 * Cuenta opcional del comensal. Sin cuenta se entra como invitado (inicio de sesión
 * anónimo) y todo funciona; con cuenta se conserva el historial en otros dispositivos.
 *
 * Si la persona ya es invitada y crea la cuenta (o enlaza Google), se CONVIERTE su
 * usuario en lugar de crear otro: así no pierde la mesa ni los platos que ya pidió.
 * Los errores salen con mensaje en español (ver errors.ts).
 */
import { describeError } from "./errors";
import { getSupabase } from "./supabase";

export type Account =
  | { status: "guest" }
  | { status: "user"; email: string };

/** Quién está usando la app ahora: invitado (o nadie) o una cuenta con correo. */
export async function readAccount(): Promise<Account> {
  const { data } = await getSupabase().auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous) return { status: "guest" };
  return { status: "user", email: user.email ?? "" };
}

async function currentUserIsAnonymous(): Promise<boolean> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.is_anonymous === true;
}

function fail(message: string): never {
  throw new Error(describeError(message));
}

/** Entra con una cuenta existente. */
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) fail(error.message);
}

/**
 * Crea la cuenta. Devuelve "confirm" si hay que abrir el correo de confirmación
 * antes de poder usarla, o "done" si ya quedó dentro.
 */
export async function signUp(email: string, password: string): Promise<"confirm" | "done"> {
  const supabase = getSupabase();
  const redirect = `${window.location.origin}/app`;

  if (await currentUserIsAnonymous()) {
    // Convierte al invitado actual en una cuenta permanente conservando su mesa.
    const { error } = await supabase.auth.updateUser({ email, password }, { emailRedirectTo: redirect });
    if (error) fail(error.message);
    return "confirm";
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirect },
  });
  if (error) fail(error.message);
  return data.session ? "done" : "confirm";
}

/** Continúa con Google (hay que activar el proveedor en Supabase). Redirige fuera de la app. */
export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  const redirectTo = `${window.location.origin}/app`;
  const { error } = (await currentUserIsAnonymous())
    ? await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } })
    : await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) fail(error.message);
}

/** Cierra la sesión. Se vuelve a entrar como invitado cuando haga falta. */
export async function signOutAccount(): Promise<void> {
  await getSupabase().auth.signOut();
}
