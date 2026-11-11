import type { ChangeRequest, OrderItem } from "@/lib/db";
import { usePricing } from "@/lib/pricing";
import { lineTotalCents, parseOptions } from "@/lib/order-items";
import { StatusBadge } from "./status-badge";

type Props = {
  item: OrderItem;
  /** Muestra el botón "Editar" (lo decide quien usa la tarjeta según permisos y estado). */
  onEdit?: () => void;
  /** Botón "Pedir cambio" para un plato que cocina ya empezó (el mesero decide). */
  onRequestChange?: () => void;
  /** Última solicitud de cambio de este plato, para mostrar su estado. */
  request?: ChangeRequest;
  /** Muestra a quién pertenece el plato (útil en la vista de toda la mesa). */
  showOwner?: boolean;
};

/**
 * Tarjeta de un plato pedido: cantidad, opciones elegidas, nota, estado y precio.
 * Es la misma para el comensal y para el personal.
 */
export function ItemCard({ item, onEdit, onRequestChange, request, showOwner = false }: Props) {
  const { formatMenu } = usePricing();
  const options = parseOptions(item.options);
  const cancelled = item.status === "cancelled";

  return (
    <article className={`pop rounded-2xl border border-line bg-card p-4 ${cancelled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`font-semibold ${cancelled ? "line-through" : ""}`}>
            {item.quantity}× {item.dish_name}
          </h3>
          {showOwner && (
            <p className="text-xs text-muted">
              {[item.for_name, item.seat_label].filter(Boolean).join(" · ") || "Mesa"}
              {item.added_by_staff ? " · lo tomó el mesero" : ""}
            </p>
          )}
        </div>
        <StatusBadge status={item.status} />
      </div>

      {options.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Opciones elegidas">
          {options.map((o) => (
            <li key={`${o.group}-${o.name}`} className="rounded-full bg-tomato/10 px-2 py-0.5 text-xs">
              {o.name}
            </li>
          ))}
        </ul>
      )}
      {item.note && <p className="mt-2 text-sm text-muted">📝 {item.note}</p>}
      {item.changed_after_start && (
        <p className="mt-2 text-xs font-medium text-amber-600">
          Se modificó cuando cocina ya había empezado.
        </p>
      )}

      {request?.status === "pending" && (
        <p role="status" className="mt-2 rounded-xl bg-tomato/10 px-3 py-2 text-sm">
          ⏳ Pediste: {request.message}. Esperando la respuesta del mesero.
        </p>
      )}
      {request?.status === "rejected" && (
        <p className="mt-2 rounded-xl bg-line px-3 py-2 text-sm text-muted">
          El mesero no pudo hacer este cambio ({request.message}). Si quieres, habla con él.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="font-bold text-tomato">{formatMenu(lineTotalCents(item))}</span>
        {onRequestChange && !cancelled && request?.status !== "pending" && (
          <button
            type="button"
            onClick={onRequestChange}
            className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm font-medium hover:bg-line"
          >
            Pedir cambio
          </button>
        )}
        {onEdit && !cancelled && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm font-medium hover:bg-line"
          >
            Editar
          </button>
        )}
      </div>
    </article>
  );
}
