import type { OrderItem } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { lineTotalCents, parseOptions } from "@/lib/order-items";
import { StatusBadge } from "./status-badge";

type Props = {
  item: OrderItem;
  /** Muestra el botón "Editar" (lo decide quien usa la tarjeta según permisos y estado). */
  onEdit?: () => void;
  /** Muestra a quién pertenece el plato (útil en la vista de toda la mesa). */
  showOwner?: boolean;
};

/**
 * Tarjeta de un plato pedido: cantidad, opciones elegidas, nota, estado y precio.
 * Es la misma para el comensal y para el personal.
 */
export function ItemCard({ item, onEdit, showOwner = false }: Props) {
  const options = parseOptions(item.options);
  const cancelled = item.status === "cancelled";

  return (
    <article className={`rounded-2xl border border-line bg-card p-4 ${cancelled ? "opacity-60" : ""}`}>
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

      <div className="mt-3 flex items-center justify-between">
        <span className="font-bold text-tomato">{formatPrice(lineTotalCents(item))}</span>
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
