"use client";

import { useState, type FormEvent } from "react";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import { inputClass, primaryButton, smallButton } from "./styles";

const FUNCTION_ERRORS: Record<string, string> = {
  email_exists: "Ese correo ya tiene cuenta. Mejor invítalo por correo o dale un enlace para unirse.",
  forbidden: "Tu rol no puede crear cuentas de ese tipo.",
  invalid_input: "Revisa el correo y el rol.",
  auth_required: "Vuelve a iniciar sesión para crear cuentas.",
};

/**
 * Crear la cuenta de un empleado: la app genera una contraseña temporal que se muestra una sola vez para
 * entregársela en persona. Al entrar por primera vez se le pide cambiarla. La cuenta se crea en un servicio
 * seguro (Edge Function) porque requiere una clave de administración que nunca llega al navegador.
 */
export function CreateStaffAccount({ roles, onCreated }: { roles: Role[]; onCreated: () => Promise<void> }) {
  const restaurant = useRestaurant();
  const { role: myRole } = usePanel();
  const options = roles.filter((r) => r !== "owner");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>(options.includes("waiter") ? "waiter" : (options[0] ?? "waiter"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(false);
    const { data, error } = await getSupabase().functions.invoke("create-staff", {
      body: { restaurant_id: restaurant.id, email, name, role },
    });
    setBusy(false);
    if (error) {
      // El mensaje de error de la función viene en el cuerpo de la respuesta.
      let code = "";
      try {
        const response = (error as { context?: Response }).context;
        code = response ? String(((await response.json()) as { error?: string }).error ?? "") : "";
      } catch {
        // Sin cuerpo legible: se usa el mensaje genérico.
      }
      setError(FUNCTION_ERRORS[code] ?? "No se pudo crear la cuenta. Inténtalo de nuevo.");
      return;
    }
    if (data && typeof data.password === "string" && typeof data.email === "string") {
      setResult({ email: data.email, password: data.password });
      setEmail("");
      setName("");
      await onCreated();
    }
  }

  if (myRole !== "owner" && myRole !== "manager") return null;

  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="font-semibold">Crear la cuenta de un empleado</h3>
      <p className="mt-1 text-sm text-muted">
        Tú le creas la cuenta y le das la contraseña temporal en persona; al entrar le pediremos que la cambie.
      </p>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ca-name" className="text-sm font-medium">
            Nombre
          </label>
          <input id="ca-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ca-email" className="text-sm font-medium">
            Correo
          </label>
          <input id="ca-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ca-role" className="text-sm font-medium">
            Rol
          </label>
          <select id="ca-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
            {options.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={busy || options.length === 0} className={primaryButton}>
            {busy ? "Creando…" : "Crear cuenta"}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className="mt-3 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm">
          <p className="font-semibold">Cuenta creada. Entrégale estos datos (la contraseña no se vuelve a mostrar):</p>
          <p className="mt-1">
            Correo: <span className="font-mono">{result.email}</span>
          </p>
          <p>
            Contraseña temporal: <span className="font-mono text-base font-semibold">{result.password}</span>
          </p>
          <button
            type="button"
            className={`${smallButton} mt-2`}
            onClick={() => void navigator.clipboard.writeText(`Correo: ${result.email}\nContraseña temporal: ${result.password}`).then(() => setCopied(true))}
          >
            {copied ? "✓ Copiado" : "Copiar datos"}
          </button>
        </div>
      )}
    </div>
  );
}
