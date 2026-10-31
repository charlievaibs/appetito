"use client";

import { useCallback, useState } from "react";
import { usePricing } from "@/lib/pricing";
import { useRestaurant } from "@/lib/panel-context";
import { ROLE_LABEL } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import { parsePerformance, personLabel, rangeStart, type PerformanceRange } from "@/lib/team";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass } from "./styles";

const RANGES: { value: PerformanceRange; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "7 días" },
  { value: "month", label: "30 días" },
];

/** Rendimiento del equipo en un periodo: mesas atendidas, platos tomados, ventas, cobros y duración de las mesas. */
export function StaffPerformance() {
  const restaurant = useRestaurant();
  const { format } = usePricing();
  const [range, setRange] = useState<PerformanceRange>("week");

  const loader = useCallback(async () => {
    const from = rangeStart(range, new Date());
    const to = new Date(Date.now() + 60_000);
    return parsePerformance(
      unwrap(
        await getSupabase().rpc("staff_performance", {
          p_restaurant_id: restaurant.id,
          p_from: from.toISOString(),
          p_to: to.toISOString(),
        }),
      ),
    );
  }, [restaurant.id, range]);
  const { data, error } = useAsyncLoad(loader);

  return (
    <section className={cardClass} aria-label="Rendimiento del equipo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Rendimiento</h2>
        <div role="group" aria-label="Periodo" className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={range === r.value}
              onClick={() => setRange(r.value)}
              className={`h-8 rounded-full px-3 text-xs font-medium ${range === r.value ? "bg-tomato text-white" : "border border-line hover:bg-line"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {!data && !error && <div className="mt-3 h-24 animate-pulse rounded-xl bg-line" aria-hidden="true" />}

      {data && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Persona</th>
                <th className="px-2 font-medium">Mesas</th>
                <th className="px-2 font-medium">Platos tomados</th>
                <th className="px-2 font-medium">Ventas de sus mesas</th>
                <th className="px-2 font-medium">Cobrado por él</th>
                <th className="px-2 font-medium">Duración media</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.userId} className="border-t border-line">
                  <td className="py-2 pr-3">
                    <span className="font-medium">{personLabel(p)}</span>
                    <span className="block text-xs text-muted">
                      {ROLE_LABEL[p.role]}
                      {!p.active && " · suspendido"}
                      {p.openTables > 0 && ` · ${p.openTables} mesa${p.openTables === 1 ? "" : "s"} abierta${p.openTables === 1 ? "" : "s"}`}
                    </span>
                  </td>
                  <td className="px-2">{p.tables}</td>
                  <td className="px-2">{p.itemsTaken}</td>
                  <td className="px-2">{format(p.salesCents)}</td>
                  <td className="px-2">
                    {format(p.collectedCents)}
                    <span className="block text-xs text-muted">{p.collectedCount} cobros</span>
                  </td>
                  <td className="px-2">{p.avgMinutes === null ? "—" : `${p.avgMinutes} min`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            Las ventas incluyen IVA y cuentan los pagos confirmados de las mesas que atendió cada persona.
          </p>
        </div>
      )}
    </section>
  );
}
