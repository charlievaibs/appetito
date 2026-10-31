"use client";

import { useEffect, useState, type FormEvent } from "react";
import { readAccount, signIn, signInWithGoogle, signOutAccount, signUp, type Account } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const fieldClass =
  "h-11 w-full rounded-xl border border-line bg-background px-4 outline-none focus:border-tomato focus:ring-2 focus:ring-tomato/30";

/**
 * Cuenta del comensal, siempre opcional: iniciar sesión, crear cuenta o continuar con
 * Google. Quien no quiera cuenta ignora este bloque y entra como invitado.
 */
export function AccountBar() {
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | null>(null);

  // La sesión vive en el navegador: se lee tras montar y se mantiene al día.
  useEffect(() => {
    let active = true;
    const refresh = () => void readAccount().then((a) => active && setAccount(a)).catch(() => undefined);
    const timer = setTimeout(refresh, 0);
    const { data } = getSupabase().auth.onAuthStateChange(() => setTimeout(refresh, 0));
    return () => {
      active = false;
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  if (!account) {
    return <div className="h-28 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }

  if (account.status === "user") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
        <p className="min-w-0 truncate text-sm">
          👤 <span className="font-medium">{account.email || "Tu cuenta"}</span>
        </p>
        <button
          type="button"
          onClick={() => void signOutAccount()}
          className="shrink-0 text-sm text-muted underline hover:text-foreground"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Cuenta" className="rounded-2xl border border-line bg-card p-4">
      <div className="grid grid-cols-2 gap-2">
        <ModeButton active={mode === "login"} onClick={() => setMode(mode === "login" ? null : "login")}>
          Iniciar sesión
        </ModeButton>
        <ModeButton active={mode === "signup"} onClick={() => setMode(mode === "signup" ? null : "signup")}>
          Crear cuenta
        </ModeButton>
      </div>
      <GoogleButton />
      {mode && <CredentialsForm key={mode} mode={mode} />}
      <p className="mt-3 text-center text-xs text-muted">
        La cuenta es opcional: también puedes pedir como invitado.
      </p>
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-11 rounded-full text-sm font-semibold transition-colors ${
        active ? "bg-tomato text-white" : "border border-line bg-background hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

/** Botón de Google; si el proveedor aún no está activado, explica el motivo en vez de fallar en silencio. */
function GoogleButton() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo continuar con Google.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-background text-sm font-semibold hover:bg-line disabled:opacity-50"
      >
        <span aria-hidden="true" className="text-base font-bold text-[#4285f4]">
          G
        </span>
        Continuar con Google
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Formulario de correo y contraseña para iniciar sesión o crear la cuenta. */
function CredentialsForm({ mode }: { mode: "login" | "signup" }) {
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
      if (mode === "login") {
        await signIn(email, password);
      } else if ((await signUp(email, password)) === "confirm") {
        setNotice("Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve aquí.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
      <label className="sr-only" htmlFor={`diner-email-${mode}`}>
        Correo
      </label>
      <input
        id={`diner-email-${mode}`}
        type="email"
        autoComplete="email"
        placeholder="Correo"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={fieldClass}
      />
      <label className="sr-only" htmlFor={`diner-password-${mode}`}>
        Contraseña
      </label>
      <input
        id={`diner-password-${mode}`}
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        placeholder="Contraseña (mínimo 8 caracteres)"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={fieldClass}
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
      <button
        type="submit"
        disabled={busy}
        className="h-11 rounded-full bg-tomato font-semibold text-white hover:bg-tomato-dark disabled:opacity-50"
      >
        {busy ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
      </button>
    </form>
  );
}
