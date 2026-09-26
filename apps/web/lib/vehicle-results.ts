import type { Doc } from "@/convex/_generated/dataModel";

export function vehicleResults(result: unknown): Doc<"vehicles">[] | undefined {
  if (result === undefined) return undefined;
  if (Array.isArray(result)) return result;
  if (
    typeof result === "object" &&
    result !== null &&
    "vehicles" in result &&
    Array.isArray(result.vehicles)
  ) {
    return result.vehicles;
  }
  throw new Error("Unexpected vehicles query response");
}
