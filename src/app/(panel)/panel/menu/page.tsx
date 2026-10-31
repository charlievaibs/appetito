import { MenuManager } from "@/components/panel/menu-manager";
import { RequirePermission } from "@/components/panel/require-permission";

export const instant = false;

export default function PanelMenuPage() {
  return (
    <RequirePermission permission="menu.edit">
      <MenuManager />
    </RequirePermission>
  );
}
