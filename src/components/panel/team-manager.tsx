"use client";

import { useCallback, useState, type FormEvent } from "react";
import { describeError } from "@/lib/errors";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { assignableRoles, parseRole, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import { parseTeam, personLabel, type TeamMember } from "@/lib/team";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { CreateStaffAccount } from "./create-staff-account";
import { StaffActivity } from "./staff-activity";
import { StaffLinks } from "./staff-links";
import { StaffPerformance } from "./staff-performance";
import { cardClass, inputClass, primaryButton, smallButton } from "./styles";

/**
 * Equipo del restaurante: sumar gente (enlace, QR o código; invitación por correo; cuenta creada por el dueño),
 * ver quién es quién y qué mesas atiende, cambiar roles, suspender o dar de baja con confirmación, y ver el
 * rendimiento y la actividad. Todo lo decide la base de datos según el rol de quien lo hace.
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
  const [removing, setRemoving] = useState<string | null>(null);

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
      getSupabase().rpc("invite_member", { p_restaurant_id: restaurant.id, p_email: email, p_role: inviteRole }),
    );
    if (ok) setEmail("");
    setBusy(false);
  }

  const shownError = error ?? loadError;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>

      <StaffLinks />

      <details className={cardClass}>
        <summary className="cursor-pointer font-semibold">Otras formas de sumar gente</summary>
        <form onSubmit={invite} className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div>
            <label htmlFor="inv-email" className="text-sm font-medium">
              Invitar por correo (se une al entrar con ese correo)
            </label>
            <input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
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
          <p className="text-xs text-muted sm:col-span-3">{ROLE_DESCRIPTION[inviteRole]}</p>
        </form>
        <CreateStaffAccount roles={roles} onCreated={reload} />
      </details>

      {shownError && (
        <p role="alert" className="text-sm text-red-600">
          {shownError}
        </p>
      )}
      {!team && !shownError && <div className="h-32 animate-pulse rounded-2xl bg-card" aria-hidden="true" />}

      {team && (
        <>
          <section aria-label="Miembros">
            <h2 className="mb-2 font-semibold">Miembros ({team.members.length})</h2>
            <ul className="flex flex-col gap-2">
              {team.members.map((m) => (
                <MemberRow
                  key={m.userId}
                  member={m}
                  mine={m.email === myEmail}
                  roles={roles}
                  removing={removing === m.userId}
                  onToggleRemove={() => setRemoving(removing === m.userId ? null : m.userId)}
                  run={async (action) => {
                    const ok = await run(action);
                    if (ok) setRemoving(null);
                  }}
                />
              ))}
            </ul>
          </section>

          {team.invites.length > 0 && (
            <section aria-label="Invitaciones pendientes">
              <h2 className="mb-2 font-semibold">Invitaciones pendientes</h2>
              <ul className="flex flex-col gap-2">
                {team.invites.map((i) => (
                  <li key={i.id} className={`${cardClass} flex flex-wrap items-center gap-3`}>
                    <p className="min-w-0 flex-1 truncate">
                      {i.email} <span className="text-sm text-muted">· {ROLE_LABEL[i.role]}</span>
                    </p>
                    <button type="button" className={smallButton} onClick={() => void run(getSupabase().rpc("revoke_invite", { p_invite_id: i.id }))}>
                      Cancelar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <StaffPerformance />
          <StaffActivity members={team.members} />
        </>
      )}
    </div>
  );
}

/** Una persona del equipo: rol, estado, mesas que atiende y acciones (suspender, dar de baja). */
function MemberRow({
  member: m,
  mine,
  roles,
  removing,
  onToggleRemove,
  run,
}: {
  member: TeamMember;
  mine: boolean;
  roles: Role[];
  removing: boolean;
  onToggleRemove: () => void;
  run: (action: PromiseLike<{ error: { message: string } | null }>) => Promise<void>;
}) {
  const restaurant = useRestaurant();
  const supabase = getSupabase();
  // Solo se administra a quien se puede asignar su rol (el gerente no toca a dueños ni a otros gerentes).
  const manageable = roles.includes(m.role);
  const [confirm, setConfirm] = useState("");

  return (
    <li className={`${cardClass} ${m.active ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {personLabel(m)}
            {mine && <span className="ml-2 text-xs text-muted">(tú)</span>}
            {!m.active && <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600">Suspendido</span>}
          </p>
          <p className="truncate text-xs text-muted">
            {m.displayName ? `${m.email} · ` : ""}
            {manageable ? "" : `${ROLE_LABEL[m.role]} · `}
            {m.openTables > 0 ? `atiende ${m.openTables} mesa${m.openTables === 1 ? "" : "s"}` : "sin mesas ahora"}
          </p>
        </div>

        {manageable && (
          <>
            <label className="sr-only" htmlFor={`role-${m.userId}`}>
              Rol de {personLabel(m)}
            </label>
            <select
              id={`role-${m.userId}`}
              value={m.role}
              onChange={(e) =>
                void run(supabase.rpc("set_member_role", { p_restaurant_id: restaurant.id, p_user_id: m.userId, p_role: e.target.value }))
              }
              className="h-9 rounded-xl border border-line bg-background px-3 text-sm"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {!mine && (
              <button
                type="button"
                className={smallButton}
                onClick={() =>
                  void run(supabase.rpc("set_member_active", { p_restaurant_id: restaurant.id, p_user_id: m.userId, p_active: !m.active }))
                }
              >
                {m.active ? "Suspender" : "Reactivar"}
              </button>
            )}
          </>
        )}
        {(manageable || mine) && (
          <button type="button" className={`${smallButton} text-red-600`} onClick={onToggleRemove}>
            {mine ? "Salir" : "Dar de baja"}
          </button>
        )}
      </div>

      {removing && (
        <form
          className="mt-3 rounded-xl border border-red-500/40 bg-red-500/5 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(supabase.rpc("remove_member", { p_restaurant_id: restaurant.id, p_user_id: m.userId, p_confirm: confirm }));
          }}
        >
          <p className="text-sm font-semibold text-red-600">
            {mine ? "Vas a salir de este restaurante." : `Vas a dar de baja a ${personLabel(m)}.`}
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs text-muted">
            <li>Perderá el acceso de inmediato. Esto no se puede deshacer; para volver tendrá que unirse de nuevo.</li>
            {m.openTables > 0 && <li>Tiene {m.openTables} mesa(s) abierta(s): quedarán sin responsable.</li>}
            <li>Si solo quieres pausar su acceso, usa «Suspender».</li>
          </ul>
          <label htmlFor={`rm-${m.userId}`} className="mt-2 block text-xs font-medium">
            Para confirmar, escribe {m.displayName ? "su nombre" : "su correo"}: <strong>{m.displayName ?? m.email}</strong>
          </label>
          <input id={`rm-${m.userId}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className={`${inputClass} mt-1 h-10`} />
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={confirm.trim() === ""}
              className="h-9 rounded-full bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {mine ? "Salir del restaurante" : "Dar de baja"}
            </button>
            <button type="button" className={smallButton} onClick={onToggleRemove}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
