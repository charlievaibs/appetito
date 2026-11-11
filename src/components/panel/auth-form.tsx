"use client";

import { useState, type FormEvent } from "react";
import { describeError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { cardClass, inputClass, primaryButton } from "./styles";

/**
 * Entrar o crear cuenta con correo y contraseña (Supabase Auth). Si el proyecto
 * exige confirmar el correo, al crear la cuenta se avisa de que hay que abrirlo.
 */
export function AuthForm({
  title,
  subtitle,
  redirectPath = "/panel",
}: {
  title?: string;
  subtitle?: string;
  /** Adónde vuelve la persona tras confirmar su correo. */
  redirectPath?: string;
} = {}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Envía el correo para elegir una contraseña nueva. */
  async function forgot() {
    if (!email) {
      setError("Escribe tu correo arriba y vuelve a tocar «Olvidé mi contraseña».");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer`,
    });
    setBusy(false);
    // Mismo aviso exista o no la cuenta, para no revelar qué correos están registrados.
    if (error && /rate limit|too many/i.test(error.message)) setError(describeError(error.message));
    else setNotice("Si ese correo tiene cuenta, te enviamos un enlace para elegir una contraseña nueva.");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = getSupabase();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${redirectPath}` },
        });
        if (error) setError(error.message);
        else if (!data.session) {
          setNotice("Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve aquí.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`mx-auto mt-10 max-w-sm ${cardClass}`}>
      <h1 className="text-2xl font-bold tracking-tight">
        {title ?? (mode === "login" ? "Entrar al panel" : "Crear cuenta")}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {subtitle ?? "Para restaurantes: gestiona tu menú, tus mesas y tus pedidos."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <label className="text-sm font-medium" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-green-600">
            {notice}
          </p>
        )}
        <button type="submit" disabled={busy} className={`mt-2 ${primaryButton}`}>
          {busy ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>

      {mode === "login" && (
        <button
          type="button"
          onClick={() => void forgot()}
          disabled={busy}
          className="mt-4 block text-sm text-muted underline hover:text-foreground"
        >
          Olvidé mi contraseña
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
          setNotice(null);
        }}
        className="mt-4 text-sm text-muted underline hover:text-foreground"
      >
        {mode === "login"
          ? "¿No tienes cuenta? Crea una"
          : "¿Ya tienes cuenta? Entra"}
      </button>
    </div>
  );
}
