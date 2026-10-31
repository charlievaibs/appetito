"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import { cardClass, inputClass, primaryButton } from "./styles";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
          options: { emailRedirectTo: `${window.location.origin}/panel` },
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
        {mode === "login" ? "Entrar al panel" : "Crear cuenta"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Para restaurantes: gestiona tu menú, tus mesas y tus pedidos.
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
