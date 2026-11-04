export function assertEventAssignment(admin: boolean, role: string | undefined, manager = false) {
  if (!admin && (!role || (manager && role !== "manager"))) throw new Error("Access to this event is required");
}

export function checkinDecision(row: { checkedIn: boolean; checkinRevision?: number; paymentStatus: string }, expectedRevision: number) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("Invalid check-in revision");
  if ((row.checkinRevision ?? 0) !== expectedRevision) throw new Error("Registration changed. Refresh before checking in.");
  if (row.paymentStatus !== "completed") throw new Error("A paid registration is required");
  return row.checkedIn ? "already_checked_in" : "checked_in";
}

export function operationReason(value: string) {
  const reason = value.trim();
  if (!reason || reason.length > 1000) throw new Error("A reason of 1–1000 characters is required");
  return reason;
}

// Only operational display names are indexed; private contact and VIN fields never enter search.
export function rosterSearchText(sellerName: string, vehicleLabel: string) {
  return `${sellerName} ${vehicleLabel}`.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 1000);
}
