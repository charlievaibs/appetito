import { RequirePermission } from "@/components/panel/require-permission";
import { SettingsForm } from "@/components/panel/settings-form";

export const instant = false;

export default function SettingsPage() {
  return (
    <RequirePermission permission="settings.edit">
      <SettingsForm />
    </RequirePermission>
  );
}
