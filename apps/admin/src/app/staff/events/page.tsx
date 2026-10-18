import { EventOperationsWorkspace } from "@/components/ui/event-operations-workspace";

export default function StaffEventsPage() {
  return (
    <div className="flex min-h-0 flex-col">
        <section className="border-b border-border bg-[hsl(var(--bone))]">
          <div className="market-shell py-10 sm:py-12">
            <p className="market-eyebrow">Gearboxe events</p>
            <h1 className="market-section-title mt-5">Popup market operations</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[hsl(var(--gunmetal))]">
              Manage your assigned events, confirm admission, and keep the day moving.
            </p>
          </div>
        </section>
        <div className="market-grid flex-1 bg-[hsl(var(--bone))]">
          <EventOperationsWorkspace hideHeading />
        </div>
    </div>
  );
}
