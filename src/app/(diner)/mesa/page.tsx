import type { Metadata } from "next";
import { TableView } from "@/components/diner/table-view";

export const metadata: Metadata = {
  title: "Tu mesa · Appetito",
  robots: { index: false, follow: false },
};

export default function TablePage() {
  return <TableView />;
}
