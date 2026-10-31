import type { ItemStatus } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/order-items";

const COLORS: Record<ItemStatus, string> = {
  pending: "bg-line text-foreground",
  preparing: "bg-amber-500/20 text-amber-600",
  ready: "bg-green-500/20 text-green-600",
  served: "bg-line text-muted",
  cancelled: "bg-red-500/10 text-red-600 line-through",
};

/** Etiqueta de color con el estado de un plato. */
export function StatusBadge({ status }: { status: string }) {
  const known = status in STATUS_LABEL;
  const key = (known ? status : "pending") as ItemStatus;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[key]}`}>
      {known ? STATUS_LABEL[key] : status}
    </span>
  );
}
