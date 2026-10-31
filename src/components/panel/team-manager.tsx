"use client";

import { useCallback, useState, type FormEvent } from "react";
import { describeError } from "@/lib/errors";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { assignableRoles, parseRole, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import { parseTeam } from "@/lib/team";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, inputClass, primaryButton, smallButton } from "./styles";

/**
 * Equipo del restaurante: quién trabaja aquí y con qué rol, e invitaciones por correo.
 * La persona invitada solo tiene que crear su cuenta (o entrar) con ese correo y
 * confirmarlo; al entrar al panel se une sola.
 */
export function TeamManager() {
  const restaurant = useRestaurant();
  const { role: myRole, state } = usePanel();
  const roles = assignableRoles(myRole);
  const myEmail = state.status === "ready" ? state.email : "";

  const loader = useCallback(
    async () =>
      parseTeam(unwrap(await getSupabase().rpc("list_team", { p_restaurant_id: restaurant.id }))),
    [restaurant.id],
  );
  const { data: team, error: loadError, reload } = useAsyncLoad(loader);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>(roles.includes("waiter") ? "waiter" : (roles[0] ?? "waiter"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Ejecuta una operación del equipo, muestra el error en español y recarga. */
  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await action;
    setError(error ? describeError(error.message) : null);
    await reload();
    return !error;
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await run(
      getSupabase().rpc("invite_member", {
        p_restaurant_id: restaurant.id,
        p_email: email,
        p_role: inviteRole,
      }),
    );
    if (ok) setEmail("");
    setBusy(false);
  }

  const shownError = error ?? loadError;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Equipo</h1>

      <form onSubmit={invite} className={`${cardClass} grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end`}>
        <div>
          <label htmlFor="inv-email" className="text-sm font-medium">
            Correo de la persona
          </label>
          <input
            id="inv-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="inv-role" className="text-sm font-medium">
            Rol
          </label>
          <select
            id="inv-role"
            value={inviteRole}
            onChange={(e) => setInviteRole(parseRole(e.target.value) ?? "waiter")}
            className={inputClass}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={busy} className={primaryButton}>
          Invitar
        </button>
        <p className="text-xs text-muted sm:col-span-3">
          {ROLE_DESCRIPTION[inviteRole]}
        </p>
      </form>

      {shownError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {shownError}
        </p>
      )}
      {!team && !shownError && (
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-card" aria-hidden="true" />
      )}

      {team && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">Miembros ({team.members.length})</h2>
          <ul className="flex flex-col gap-2">
            {team.members.map((m) => {
              const mine = m.email === myEmail;
              // Solo se puede cambiar el rol si se puede asignar tanto el actual como los nuevos.
              const editable = roles.includes(m.role);
              return (
                <li key={m.userId} className={`${cardClass} flex flex-wrap items-center gap-3`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.email}
                      {mine && <span className="ml-2 text-xs text-muted">(tú)</span>}
                    </p>
                    {!editable && <p className="text-xs text-muted">{ROLE_LABEL[m.role]}</p>}
                  </div>
                  {editable && (
                    <>
                      <label className="sr-only" htmlFor={`role-${m.userId}`}>
                        Rol de {m.email}
                      </label>
                      <select
                        id={`role-${m.userId}`}
                        value={m.role}
                        onChange={(e) =>
                          void run(
                            getSupabase().rpc("set_member_role", {
                              p_restaurant_id: restaurant.id,
                              p_user_id: m.userId,
                              p_role: e.target.value,
                            }),
                          )
                        }
                        className="h-9 rounded-xl border border-line bg-background px-3 text-sm"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  {(editable || mine) && (
                    <button
                      type="button"
                      className={`${smallButton} text-red-600`}
                      onClick={() => {
                        if (window.confirm(mine ? "¿Salir de este restaurante?" : `¿Quitar a ${m.email}?`)) {
                          void run(
                            getSupabase().rpc("remove_member", {
                              p_restaurant_id: restaurant.id,
                              p_user_id: m.userId,
                            }),
                          );
                        }
                      }}
                    >
                      {mine ? "Salir" : "Quitar"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {team.invites.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 font-semibold">Invitaciones pendientes</h2>
              <ul className="flex flex-col gap-2">
                {team.invites.map((i) => (
                  <li key={i.id} className={`${cardClass} flex flex-wrap items-center gap-3`}>
                    <p className="min-w-0 flex-1 truncate">
                      {i.email} <span className="text-sm text-muted">· {ROLE_LABEL[i.role]}</span>
                    </p>
                    <button
                      type="button"
                      className={smallButton}
                      onClick={() => void run(getSupabase().rpc("revoke_invite", { p_invite_id: i.id }))}
                    >
                      Cancelar
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
