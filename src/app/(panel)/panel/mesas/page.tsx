import { RequirePermission } from "@/components/panel/require-permission";
import { TablesManager } from "@/components/panel/tables-manager";

export const instant = false;

export default function TablesPage() {
  return (
    <RequirePermission permission="tables.edit">
      <TablesManager />
    </RequirePermission>
  );
}
