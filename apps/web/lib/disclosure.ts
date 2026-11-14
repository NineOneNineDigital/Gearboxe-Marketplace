// A blank seller statement is not a verification of vehicle condition.
export function displayDisclosure(value?: string): string {
  return value?.trim() || "No issue disclosed by seller";
}
