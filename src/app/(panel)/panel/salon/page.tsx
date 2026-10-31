import { RequirePermission } from "@/components/panel/require-permission";
import { SalonBoard } from "@/components/panel/salon-board";

export const instant = false;

export default function SalonPage() {
  return (
    <RequirePermission permission="orders.take">
      <SalonBoard />
    </RequirePermission>
  );
}
