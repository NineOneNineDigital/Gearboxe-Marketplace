import { Button } from "@/components/ui/button";
import { ClipboardCheck, Truck, ShieldCheck, Wallet } from "lucide-react";

const services = [
  { title: "Pre-purchase inspection", description: "Get an independent look at the vehicle before you commit.", icon: ClipboardCheck },
  { title: "Vehicle shipping", description: "Explore transport options to get your next vehicle home.", icon: Truck },
  { title: "Insurance", description: "Explore coverage options for your next vehicle.", icon: ShieldCheck },
  { title: "Lending", description: "Explore financing options for your vehicle purchase.", icon: Wallet },
];

export function BuyerServices() {
  return (
    <section aria-labelledby="buyer-services-title" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-white/10 bg-[hsl(var(--midnight))] p-6 sm:p-7">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Buyer services</p>
        <h2 id="buyer-services-title" className="mt-3 text-2xl font-semibold tracking-tight text-[hsl(var(--bone))]">Buy with more confidence.</h2>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--chrome))]">Tools for the next step in your vehicle search. Services are coming soon.</p>
      </div>
      <div className="grid gap-px bg-border md:grid-cols-2">
        {services.map(({ title, description, icon: Icon }) => (
          <article key={title} className="flex flex-col bg-card p-6">
            <Icon aria-hidden="true" className="mb-5 h-6 w-6 text-primary" strokeWidth={1.5} />
            <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
            <p className="mt-2 mb-6 text-sm leading-6 text-muted-foreground">{description}</p>
            <Button type="button" variant="outline" size="sm" disabled className="mt-auto w-full">Coming soon</Button>
          </article>
        ))}
      </div>
    </section>
  );
}
