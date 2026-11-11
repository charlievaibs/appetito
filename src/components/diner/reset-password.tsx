"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { describeError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { cardClass, inputClass, primaryButton } from "@/components/panel/styles";

/**
 * Pantalla a la que llega el enlace del correo de «Olvidé mi contraseña».
 * Supabase entrega una sesión de recuperación; con ella se puede fijar una contraseña nueva.
 */
export function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Si el enlace ya se procesó antes de montar, la sesión existe: también vale.
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session && window.location.hash.includes("type=recovery")) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className={`mx-auto mt-10 max-w-sm text-center ${cardClass}`}>
        <p className="text-4xl" aria-hidden="true">
          ✅
        </p>
        <h1 className="mt-2 text-xl font-bold">Contraseña actualizada</h1>
        <p className="mt-1 text-sm text-muted">Ya puedes entrar con tu contraseña nueva.</p>
        <Link href="/panel" className={`mt-4 ${primaryButton}`}>
          Ir al panel
        </Link>
      </div>
    );
  }

  return (
    <div className={`mx-auto mt-10 max-w-sm ${cardClass}`}>
      <h1 className="text-2xl font-bold tracking-tight">Nueva contraseña</h1>
      {!ready ? (
        <p className="mt-2 text-sm text-muted">
          Abre esta página desde el enlace que te enviamos al correo. Si ya caducó, pide uno nuevo desde «Olvidé mi
          contraseña».
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="new-pass">
            Elige una contraseña (mínimo 8 caracteres)
          </label>
          <input
            id="new-pass"
            type="password"
            autoComplete="new-password"
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
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? "Un momento…" : "Guardar contraseña"}
          </button>
        </form>
      )}
    </div>
  );
}
