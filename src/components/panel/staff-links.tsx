"use client";

import { useCallback, useState, type FormEvent } from "react";
import { QrImage } from "@/components/qr-image";
import { describeError } from "@/lib/errors";
import { useRestaurant, usePanel } from "@/lib/panel-context";
import { assignableRoles, ROLE_LABEL, type Role } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, inputClass, primaryButton, smallButton } from "./styles";

/** Dirección que abre quien recibe el enlace para unirse al equipo. */
export function joinUrl(origin: string, code: string): string {
  return `${origin}/unirse/${encodeURIComponent(code)}`;
}

/**
 * Sumar gente al equipo con un enlace, un QR o un código (sirve para todos los roles, hasta gerente). El enlace
 * caduca, tiene usos limitados y se puede revocar; quien lo usa debe tener una cuenta con el correo confirmado.
 */
export function StaffLinks() {
  const restaurant = useRestaurant();
  const { role: myRole } = usePanel();
  // El enlace de dueño no existe: un nuevo dueño se nombra con una invitación por correo.
  const roles = assignableRoles(myRole).filter((r) => r !== "owner");

  const [role, setRole] = useState<Role>(roles.includes("waiter") ? "waiter" : (roles[0] ?? "waiter"));
  const [days, setDays] = useState(7);
  const [maxUses, setMaxUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; role: Role } | null>(null);
  const [copied, setCopied] = useState(false);

  const loader = useCallback(
    async () =>
      unwrap(
        await getSupabase()
          .from("staff_join_links")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .eq("active", true)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }),
      ),
    [restaurant.id],
  );
  const { data: links, error: loadError, reload } = useAsyncLoad(loader);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCopied(false);
    const { data, error } = await getSupabase().rpc("create_staff_link", {
      p_restaurant_id: restaurant.id,
      p_role: role,
      p_days: days,
      p_max_uses: maxUses,
    });
    setBusy(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    const code = typeof data === "object" && data !== null && !Array.isArray(data) && typeof data.code === "string" ? data.code : null;
    if (code) setCreated({ code, role });
    await reload();
  }

  async function revoke(id: string) {
    const { error } = await getSupabase().rpc("revoke_staff_link", { p_link_id: id });
    setError(error ? describeError(error.message) : null);
    if (created && links?.find((l) => l.id === id)?.code === created.code) setCreated(null);
    await reload();
  }

  const url = created ? joinUrl(window.location.origin, created.code) : null;

  return (
    <section className={cardClass} aria-label="Unirse con enlace">
      <h2 className="font-semibold">Sumar gente con un enlace, QR o código</h2>
      <p className="mt-1 text-sm text-muted">
        La persona crea su cuenta (o entra) y se une sola con el rol que elijas. Sirve para cualquier rol, también gerente.
      </p>

      <form onSubmit={create} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="sl-role" className="text-sm font-medium">
            Rol
          </label>
          <select id="sl-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${inputClass} w-44`}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sl-days" className="text-sm font-medium">
            Válido por
          </label>
          <select id="sl-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${inputClass} w-32`}>
            <option value={1}>1 día</option>
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
          </select>
        </div>
        <div>
          <label htmlFor="sl-uses" className="text-sm font-medium">
            Personas
          </label>
          <select id="sl-uses" value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className={`${inputClass} w-32`}>
            <option value={1}>1 persona</option>
            <option value={5}>Hasta 5</option>
            <option value={20}>Hasta 20</option>
          </select>
        </div>
        <button type="submit" disabled={busy || roles.length === 0} className={primaryButton}>
          Crear enlace
        </button>
      </form>

      {(error ?? loadError) && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error ?? loadError}
        </p>
      )}

      {created && url && (
        <div className="mt-4 flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-background p-4">
          <div className="rounded-xl bg-white p-2">
            <QrImage value={url} label="QR para unirse al equipo" size={150} />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Nuevo enlace para {ROLE_LABEL[created.role]}</p>
            <p className="mt-1 break-all rounded-lg bg-line px-2 py-1 font-mono text-xs">{url}</p>
            <p className="mt-2">
              O que escriban el código <span className="font-mono text-base font-semibold tracking-widest">{created.code}</span> en{" "}
              <strong>/unirse</strong>.
            </p>
            <button
              type="button"
              className={`${smallButton} mt-2`}
              onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true))}
            >
              {copied ? "✓ Copiado" : "Copiar enlace"}
            </button>
          </div>
        </div>
      )}

      {links && links.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Enlaces activos</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                <span className="flex-1">
                  <strong>{ROLE_LABEL[l.role as Role] ?? l.role}</strong> · <span className="font-mono tracking-widest">{l.code}</span>
                  <span className="block text-xs text-muted">
                    {l.uses} de {l.max_uses} usos · vence {new Date(l.expires_at).toLocaleDateString("es-VE")}
                  </span>
                </span>
                <button type="button" className={`${smallButton} text-red-600`} onClick={() => void revoke(l.id)}>
                  Revocar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
