import type { Metadata } from "next";
import { ResetPassword } from "@/components/diner/reset-password";

export const metadata: Metadata = {
  title: "Nueva contraseña · Appetito",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <ResetPassword />;
}
