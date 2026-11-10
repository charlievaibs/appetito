import { IntegrationsPanel } from "@/components/panel/integrations-panel";
import { RequirePermission } from "@/components/panel/require-permission";

export const instant = false;

export default function PanelIntegrationsPage() {
  return (
    <RequirePermission permission="settings.edit">
      <IntegrationsPanel />
    </RequirePermission>
  );
}
