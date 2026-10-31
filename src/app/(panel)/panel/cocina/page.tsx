import { KitchenBoard } from "@/components/panel/kitchen-board";
import { RequirePermission } from "@/components/panel/require-permission";

export const instant = false;

export default function KitchenPage() {
  return (
    <RequirePermission permission="orders.kitchen">
      <KitchenBoard />
    </RequirePermission>
  );
}
