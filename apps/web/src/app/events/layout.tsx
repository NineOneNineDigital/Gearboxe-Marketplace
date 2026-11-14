import { popupPaymentsEnabled } from "@/convex/lib/environment";
import { notFound } from "next/navigation";

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  if (!popupPaymentsEnabled()) notFound();
  return children;
}
