"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  joinTableManual,
  listTablesForJoin,
  type JoinTable,
  type SessionContext,
} from "@/lib/diner-api";
import { saveSession } from "@/lib/diner-session";
import { useAsyncLoad } from "@/lib/use-async-load";
import { WaitingForWaiter } from "./waiting-for-waiter";

const STATUS_LABEL: Record<JoinTable["status"], string> = {
  free: "Libre",
  occupied: "Ocupada",
  reserved: "Reservada",
};

const STATUS_STYLE: Record<JoinTable["status"], string> = {
  free: "bg-green-500/20 text-green-600",
  occupied: "bg-line text-muted",
  reserved: "bg-amber-500/20 text-amber-600",
};

/**
 * Elegir la mesa y el asiento a mano, como butacas en un cine, para quien no escanea ni
 * usa NFC. Una mesa libre se toma al instante (si el restaurante lo permite); una ocupada o
 * reservada se abre con el código que da quien reservó o el mesero, o pidiendo acceso al mesero.
 */
export function TablePicker({ slug }: { slug: string }) {
  const loader = useCallback(() => listTablesForJoin(slug), [slug]);
  const { data, error, reload } = useAsyncLoad(loader);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ requestId: string; table: string } | null>(null);

  // Si el restaurante no permite elegir mesa a mano (o aún carga), no se muestra nada.
  if (!data) {
    return error ? (
      <p role="alert" className="mt-4 text-sm text-red-600">
        {error}
      </p>
    ) : null;
  }

  if (pending) {
    return <WaitingForWaiter requestId={pending.requestId} table={pending.table} onDone={() => setPending(null)} />;
  }

  return (
    <section aria-labelledby="picker-title" className="mt-6 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="picker-title" className="font-semibold">
            ¿Ya estás sentado aquí?
          </h2>
          <p className="text-sm text-muted">Elige tu mesa y tu asiento, sin escanear nada.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            if (!open) void reload();
          }}
          aria-expanded={open}
          className="h-10 shrink-0 rounded-full bg-tomato px-4 text-sm font-semibold text-white hover:bg-tomato-dark"
        >
          {open ? "Cerrar" : "Elegir mesa"}
        </button>
      </div>
      {open && (
        <TableGrid
          tables={data.tables}
          manualJoin={data.manualJoin}
          onPending={(requestId, table) => setPending({ requestId, table })}
        />
      )}
    </section>
  );
}

/** Cuadrícula de mesas; al tocar una se abre su panel con asientos, nombre y código. */
function TableGrid({
  tables,
  manualJoin,
  onPending,
}: {
  tables: JoinTable[];
  manualJoin: "approval" | "open";
  onPending: (requestId: string, table: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tables.find((t) => t.id === selectedId) ?? null;

  if (tables.length === 0) {
    return <p className="mt-4 text-sm text-muted">Este restaurante todavía no tiene mesas disponibles.</p>;
  }

  return (
    <div className="mt-4">
      <ul className="grid grid-cols-2 gap-3" aria-label="Mesas">
        {tables.map((t) => {
          const free = t.seats.filter((s) => !s.taken).length;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                aria-pressed={t.id === selectedId}
                className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                  t.id === selectedId ? "border-tomato bg-tomato/10" : "border-line bg-background hover:bg-line"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{t.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </span>
                <span className="mt-2 flex flex-wrap gap-1" aria-hidden="true">
                  {t.seats.map((s) => (
                    <span
                      key={s.id}
                      className={`h-3 w-3 rounded-full ${s.taken ? "bg-muted" : "border border-tomato"}`}
                    />
                  ))}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {t.seats.length > 0 ? `${free} de ${t.seats.length} asientos libres` : `Capacidad ${t.capacity}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected && <JoinPanel key={selected.id} table={selected} manualJoin={manualJoin} onPending={onPending} />}
    </div>
  );
}

/** Panel de la mesa elegida: asiento, nombre opcional y código para mesas ocupadas o reservadas. */
function JoinPanel({
  table,
  manualJoin,
  onPending,
}: {
  table: JoinTable;
  manualJoin: "approval" | "open";
  onPending: (requestId: string, table: string) => void;
}) {
  const router = useRouter();
  const [seatId, setSeatId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const instant = table.status === "free" && manualJoin === "open";
  const hasCode = code.trim().length > 0;
  const buttonLabel = hasCode ? "Entrar con el código" : instant ? "Sentarme aquí" : "Pedir acceso al mesero";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await joinTableManual(table.id, {
        seatId: seatId ?? undefined,
        displayName: name || undefined,
        code: code || undefined,
      });
      if (result.status === "pending") {
        onPending(result.requestId, table.label);
        return;
      }
      enterTable(result.ctx, router.replace);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entrar a la mesa.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-background p-4">
      <h3 className="font-semibold">{table.label}</h3>

      {table.seats.length > 0 && (
        <>
          <p className="mt-2 text-sm text-muted">Elige tu asiento (opcional)</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Asientos">
            {table.seats.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={s.taken}
                onClick={() => setSeatId(s.id === seatId ? null : s.id)}
                aria-pressed={s.id === seatId}
                className={`h-10 min-w-10 rounded-full px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  s.id === seatId ? "bg-tomato text-white" : "border border-line bg-card hover:bg-line"
                }`}
              >
                {s.taken ? `${s.label} · ocupado` : s.label}
              </button>
            ))}
          </div>
        </>
      )}

      <label htmlFor="join-name" className="mt-3 block text-sm font-medium">
        Tu nombre (opcional)
      </label>
      <input
        id="join-name"
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-line bg-card px-4"
      />

      {table.status !== "free" && (
        <>
          <label htmlFor="join-code" className="mt-3 block text-sm font-medium">
            {table.status === "reserved" ? "Código de la reserva" : "Código de la mesa"} (si lo tienes)
          </label>
          <input
            id="join-code"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={12}
            placeholder="Por ejemplo K7M2QP"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="mt-1 h-11 w-full rounded-xl border border-line bg-card px-4 font-mono tracking-widest"
          />
          <p className="mt-1 text-xs text-muted">
            Te lo da quien hizo la reserva o tu mesero. Sin código, tu mesero te dará acceso.
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-4 h-11 w-full rounded-full bg-tomato font-semibold text-white hover:bg-tomato-dark disabled:opacity-50"
      >
        {busy ? "Un momento…" : buttonLabel}
      </button>
    </div>
  );
}

/** Guarda la mesa en el dispositivo y lleva al comensal a ella. */
export function enterTable(ctx: SessionContext, replace: (href: string) => void) {
  saveSession({ sessionId: ctx.sessionId, restaurantName: ctx.restaurant.name, tableLabel: ctx.table.label });
  replace("/mesa");
}
