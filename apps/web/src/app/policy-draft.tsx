import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export function PolicyDraft({ title, children }: { title: string; children: ReactNode }) {
  // The founder has not approved this wording or supplied the legal entity/address.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="market-page min-h-screen flex flex-col">
      <Navbar />
      <main className="market-shell flex-1 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-8 text-sm leading-7 text-slate-700">
          <header className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">Founder review draft · November 10, 2026</p>
            <h1 className="text-4xl font-semibold text-slate-950">{title}</h1>
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
              Draft for review. This is not the effective marketplace policy. The legal entity and mailing address are still to be confirmed.
            </p>
          </header>
          {children}
          <p className="border-t pt-6">
            Questions about this draft? Email <a className="underline" href="mailto:Help@gearboxe.com">Help@gearboxe.com</a>. See also the <Link className="underline" href="/terms">Terms</Link> and <Link className="underline" href="/privacy">Privacy Policy</Link> drafts.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3"><h2 className="text-xl font-semibold text-slate-950">{title}</h2>{children}</section>;
}
