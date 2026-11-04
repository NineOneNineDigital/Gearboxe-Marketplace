import { BrandLockup } from "./brand-lockup";

export function AuthShell({ area, children }: { area: "market" | "admin"; children: React.ReactNode }) {
  const admin = area === "admin";

  if (admin) {
    return <div className="market-grid flex min-h-dvh items-center justify-center bg-[hsl(var(--bone))] px-4 py-12 sm:px-8">
      <main className="w-full max-w-md">
        <div className="mb-10 flex justify-center"><BrandLockup label="Admin" /></div>
        {children}
      </main>
    </div>;
  }

  return <div className="grid min-h-dvh bg-[hsl(var(--bone))] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <aside className="relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-[hsl(var(--midnight))] px-10 py-10 text-[hsl(var(--bone))] lg:flex xl:px-16 xl:py-14">
      <div className="market-grid pointer-events-none absolute inset-0 opacity-15" aria-hidden="true" />
      <div className="relative"><BrandLockup inverse label="Market" /></div>
      <div className="relative max-w-lg">
        <p className="market-eyebrow text-[hsl(var(--chrome))]">Gearboxe market</p>
        <h2 className="mt-6 text-[clamp(2.6rem,4.5vw,5rem)] font-semibold leading-[1.04] tracking-[-0.06em]">
          Find your people.<br /><span className="text-primary">Find your drive.</span>
        </h2>
        <p className="mt-6 max-w-md text-sm leading-7 text-[hsl(var(--chrome))]">
          Discover standout vehicles, meet local enthusiasts, and be part of the next popup market.
        </p>
        <div className="market-ruler mt-10 max-w-sm opacity-60" aria-hidden="true" />
      </div>
      <p className="relative font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--chrome))]">Built for the drive</p>
    </aside>
    <main className="flex min-h-dvh flex-col justify-center px-4 py-12 sm:px-8 lg:px-12 xl:px-20">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-10 lg:hidden"><BrandLockup label="Market" /></div>
        {children}
      </div>
    </main>
  </div>;
}
