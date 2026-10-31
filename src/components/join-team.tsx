"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AuthForm } from "@/components/panel/auth-form";
import { cardClass, inputClass, primaryButton } from "@/components/panel/styles";
import { describeError } from "@/lib/errors";
import { ROLE_LABEL, parseRole } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";

type Preview = { restaurant: string; role: string } | null;
type Session = { status: "loading" } | { status: "guest" } | { status: "user"; email: string };

/**
 * Unirse al equipo de un restaurante con un enlace, un QR o un código. La persona ve a qué restaurante y con qué
 * rol entraría, crea su cuenta (o entra) y se une con su nombre. Sirve para cualquier rol del equipo.
 */
export function JoinTeam({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState((initialCode ?? "").toUpperCase());
  const [typed, setTyped] = useState("");
  const [preview, setPreview] = useState<Preview | "checking">(initialCode ? "checking" : null);
  const [session, setSession] = useState<Session>({ status: "loading" });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ restaurant: string; role: string } | null>(null);

  const checkCode = useCallback(async (value: string) => {
    setPreview("checking");
    const { data } = await getSupabase().rpc("preview_staff_link", { p_code: value });
    const ok = typeof data === "object" && data !== null && !Array.isArray(data) && typeof data.restaurant === "string" && typeof data.role === "string";
    setPreview(ok ? { restaurant: data.restaurant as string, role: data.role as string } : null);
  }, []);

  // La sesión vive en el navegador y el código se comprueba al llegar.
  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    const refresh = () =>
      void supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        const user = data.session?.user;
        setSession(!user || user.is_anonymous ? { status: "guest" } : { status: "user", email: user.email ?? "" });
      });
    const first = setTimeout(() => {
      refresh();
      if (initialCode) void checkCode(initialCode);
    }, 0);
    const { data } = supabase.auth.onAuthStateChange(() => setTimeout(refresh, 0));
    return () => {
      active = false;
      clearTimeout(first);
      data.subscription.unsubscribe();
    };
  }, [initialCode, checkCode]);

  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await getSupabase().rpc("redeem_staff_link", { p_code: code, p_display_name: name });
    setBusy(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    const result = data as { restaurant?: string; role?: string } | null;
    setJoined({ restaurant: result?.restaurant ?? "el restaurante", role: result?.role ?? "" });
  }

  if (joined) {
    return (
      <div className={`mx-auto mt-10 max-w-sm text-center ${cardClass}`}>
        <p className="text-5xl" aria-hidden="true">
          🎉
        </p>
        <h1 className="mt-3 text-xl font-bold">¡Ya eres parte de {joined.restaurant}!</h1>
        <p className="mt-1 text-muted">Tu rol: {ROLE_LABEL[parseRole(joined.role) ?? "waiter"]}</p>
        <Link href="/panel" className={`mt-5 ${primaryButton}`}>
          Ir al panel
        </Link>
      </div>
    );
  }

  // Sin código todavía: se pide escribirlo.
  if (!initialCode && preview === null) {
    return (
      <form
        className={`mx-auto mt-10 max-w-sm ${cardClass}`}
        onSubmit={(e) => {
          e.preventDefault();
          const value = typed.trim().toUpperCase();
          setCode(value);
          void checkCode(value);
        }}
      >
        <h1 className="text-2xl font-bold tracking-tight">Unirme a un restaurante</h1>
        <p className="mt-1 text-sm text-muted">Escribe el código que te dio tu gerente o dueño, o abre el enlace o el QR que te enviaron.</p>
        <label htmlFor="join-code" className="mt-4 block text-sm font-medium">
          Código
        </label>
        <input
          id="join-code"
          required
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value.toUpperCase())}
          className={`${inputClass} font-mono tracking-widest`}
        />
        <button type="submit" className={`mt-3 w-full ${primaryButton}`}>
          Continuar
        </button>
      </form>
    );
  }

  if (preview === "checking" || session.status === "loading") {
    return <div className="mx-auto mt-10 h-40 max-w-sm animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }

  if (preview === null) {
    return (
      <div className={`mx-auto mt-10 max-w-sm text-center ${cardClass}`}>
        <p className="text-5xl" aria-hidden="true">
          ⌛
        </p>
        <h1 className="mt-3 text-xl font-bold">Ese enlace no es válido</h1>
        <p className="mt-1 text-muted">Puede haber caducado, haberse usado ya o haber sido revocado. Pide uno nuevo a tu gerente o dueño.</p>
        <Link href="/unirse" className="mt-4 inline-block font-semibold text-tomato underline">
          Escribir otro código
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className={`${cardClass} text-center`}>
        <p className="text-sm text-muted">Te invitan a unirte a</p>
        <h1 className="text-2xl font-bold tracking-tight">{preview.restaurant}</h1>
        <p className="mt-1">
          como <strong>{ROLE_LABEL[parseRole(preview.role) ?? "waiter"]}</strong>
        </p>
      </div>

      {session.status === "guest" ? (
        <AuthForm
          title="Crea tu cuenta o entra"
          subtitle="Con tu cuenta te unes al equipo. Usa un correo que puedas confirmar."
          redirectPath={`/unirse/${code}`}
        />
      ) : (
        <form onSubmit={join} className={`mt-4 ${cardClass}`}>
          <p className="text-sm text-muted">Entraste como {session.email}</p>
          <label htmlFor="join-name" className="mt-3 block text-sm font-medium">
            Tu nombre (así te verá el equipo)
          </label>
          <input id="join-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={`mt-4 w-full ${primaryButton}`}>
            {busy ? "Uniéndote…" : "Unirme al equipo"}
          </button>
        </form>
      )}
    </div>
  );
}
