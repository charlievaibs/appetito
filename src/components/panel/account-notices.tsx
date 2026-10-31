"use client";

import { useState, type FormEvent } from "react";
import { describeError } from "@/lib/errors";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import { inputClass, smallButton } from "./styles";

/**
 * Avisos de la cuenta del personal, arriba del panel:
 * - Si su contraseña es temporal (se la creó el dueño), debe cambiarla ahora.
 * - Si todavía no tiene nombre, lo pone para que el equipo lo identifique (por ejemplo en las mesas que atiende).
 */
export function AccountNotices() {
  const { state, reload } = usePanel();
  const restaurant = useRestaurant();
  const ready = state.status === "ready" ? state : null;
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.updateUser({ password, data: { temp_password: false } });
    setBusy(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    setPassword("");
    await reload();
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().rpc("set_my_name", { p_restaurant_id: restaurant.id, p_name: name });
    setBusy(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    await reload();
  }

  if (ready.tempPassword) {
    return (
      <form onSubmit={changePassword} className="mt-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 print:hidden">
        <p className="font-semibold">Cambia tu contraseña temporal</p>
        <p className="text-sm text-muted">Te la dio el dueño o gerente; elige una propia que solo tú conozcas.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="new-password">
            Nueva contraseña
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Nueva contraseña (mínimo 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} h-10 max-w-xs`}
          />
          <button type="submit" disabled={busy} className={smallButton}>
            Guardar contraseña
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
    );
  }

  if (!ready.names[restaurant.id]) {
    return (
      <form onSubmit={saveName} className="mt-4 rounded-2xl border border-line bg-card p-4 print:hidden">
        <p className="font-semibold">¿Cómo te llamas?</p>
        <p className="text-sm text-muted">Tu equipo te verá con este nombre, por ejemplo en las mesas que atiendes.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="my-name">
            Tu nombre
          </label>
          <input id="my-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} h-10 max-w-xs`} />
          <button type="submit" disabled={busy} className={smallButton}>
            Guardar
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
    );
  }
  return null;
}
