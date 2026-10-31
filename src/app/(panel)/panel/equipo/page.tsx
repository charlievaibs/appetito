import { RequirePermission } from "@/components/panel/require-permission";
import { TeamManager } from "@/components/panel/team-manager";

export const instant = false;

export default function TeamPage() {
  return (
    <RequirePermission permission="team.manage">
      <TeamManager />
    </RequirePermission>
  );
}
