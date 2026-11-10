import { InventoryManager } from "@/components/panel/inventory-manager";
import { RequirePermission } from "@/components/panel/require-permission";

export const instant = false;

export default function PanelInventoryPage() {
  return (
    <RequirePermission permission="inventory.adjust">
      <InventoryManager />
    </RequirePermission>
  );
}
