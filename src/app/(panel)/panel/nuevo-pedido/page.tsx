import { RequirePermission } from "@/components/panel/require-permission";
import { StaffOrder } from "@/components/panel/staff-order";

export const instant = false;

export default function NewOrderPage() {
  return (
    <RequirePermission permission="orders.take">
      <StaffOrder />
    </RequirePermission>
  );
}
