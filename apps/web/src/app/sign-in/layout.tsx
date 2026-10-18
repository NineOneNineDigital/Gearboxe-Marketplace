import { AuthShell } from "@/components/ui/auth-shell";

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="light"><AuthShell area="market">{children}</AuthShell></div>;
}
