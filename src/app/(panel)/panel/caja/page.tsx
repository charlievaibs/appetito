import { CajaBoard } from "@/components/panel/caja-board";
import { RequirePermission } from "@/components/panel/require-permission";

export const instant = false;

export default function CajaPage() {
  return (
    <RequirePermission permission="payments.manage">
      <CajaBoard />
    </RequirePermission>
  );
}
