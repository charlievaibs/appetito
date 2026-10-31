"use client";

import { useCallback } from "react";
import { useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import { describeStaffEvent, type TeamMember } from "@/lib/team";
import { personLabel } from "@/lib/team";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass } from "./styles";

/** Registro de lo que ha pasado con el equipo (quién entró, quién cambió un rol, quién fue dado de baja…). */
export function StaffActivity({ members }: { members: TeamMember[] }) {
  const restaurant = useRestaurant();
  const loader = useCallback(
    async () =>
      unwrap(
        await getSupabase()
          .from("staff_events")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })
          .limit(15),
      ),
    [restaurant.id],
  );
  const { data, error } = useAsyncLoad(loader);
  const nameOf = (id: string | null) => {
    const m = members.find((x) => x.userId === id);
    return m ? personLabel(m) : "Alguien que ya no está";
  };

  return (
    <section className={cardClass} aria-label="Actividad del equipo">
      <h2 className="font-semibold">Actividad reciente</h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {data?.length === 0 && <p className="mt-2 text-sm text-muted">Todavía no hay actividad registrada.</p>}
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {data?.map((e) => (
          <li key={e.id} className="flex flex-wrap gap-x-2">
            <span className="text-xs text-muted">
              {new Date(e.created_at).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}
            </span>
            <span>
              <strong>{nameOf(e.actor)}</strong>: {describeStaffEvent(e.action, e.detail)}
              {e.target && e.target !== e.actor ? ` · ${nameOf(e.target)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
