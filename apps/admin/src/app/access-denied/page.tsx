import { AuthShell } from "@/components/ui/auth-shell";

export default function AccessDeniedPage() {
  return <div className="min-h-0 flex-1 overflow-y-auto"><AuthShell area="admin">
    <div className="space-y-5 text-center">
      <p className="market-eyebrow">Gearboxe operations</p>
      <h1 className="market-section-title">Access required</h1>
      <p className="text-sm leading-7 text-[hsl(var(--gunmetal))]">This account has no active employee role or assigned events. Ask a Gearboxe administrator to grant access to the event you work on.</p>
    </div>
  </AuthShell></div>;
}
