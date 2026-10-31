import { OrdersBoard } from "@/components/panel/orders-board";

// El panel depende de la sesión y se decide en el cliente: no es navegación instantánea.
export const instant = false;

export default function PanelHome() {
  return <OrdersBoard />;
}
