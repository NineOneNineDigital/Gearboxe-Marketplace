import type { Doc } from "@/convex/_generated/dataModel";

function display(value: string | number | undefined): string {
  if (value === undefined || value === "") return "Not provided";
  return String(value).replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}

export function VehicleDetails({ vehicle }: { vehicle: Doc<"vehicles"> }) {
  const essentials = [
    ["Mileage", `${vehicle.mileage.toLocaleString("en-US")} ${vehicle.mileageUnit ?? "mi"}`],
    ["Engine", vehicle.engine], ["Transmission", vehicle.transmission],
    ["Drivetrain", vehicle.drivetrain], ["Title", vehicle.titleStatus], ["Condition", vehicle.condition],
  ] as const;


  return (
    <section aria-labelledby="vehicle-details-title" className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 id="vehicle-details-title" className="text-xl font-semibold tracking-tight text-foreground">Vehicle details</h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {essentials.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{display(value)}</dd></div>)}
      </dl>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs">
        <p className="text-muted-foreground">VIN <span className="ml-2 break-all font-mono text-foreground">{vehicle.vin || "Not provided"}</span></p>
        <span className="text-muted-foreground">{vehicle.vinVerificationStatus === "decoded" ? "VIN decoded" : "VIN not decoded"}</span>
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Seller’s description</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{vehicle.description}</p>
      </div>
    </section>
  );
}
