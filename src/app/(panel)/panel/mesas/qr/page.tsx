import { QrSheet } from "@/components/panel/qr-sheet";
import { RequirePermission } from "@/components/panel/require-permission";

export const instant = false;

export default function QrSheetPage() {
  return (
    <RequirePermission permission="tables.edit">
      <QrSheet />
    </RequirePermission>
  );
}
