import type { Metadata } from "next";
import { DinerHome } from "@/components/diner/diner-home";

export const metadata: Metadata = {
  title: "Appetito · Pide desde tu mesa",
  description: "Entra a tu mesa con NFC o QR, pide y ajusta tu plato sin llamar al mesero.",
};

export default function DinerHomePage() {
  return <DinerHome />;
}
