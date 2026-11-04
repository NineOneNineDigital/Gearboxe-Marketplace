export interface ListingEditorSession {
  routeId: string | null;
  generation: number;
  createdId: string | null;
}

// Only our own first draft URL replacement belongs to the same editor session.
export function transitionListingEditorSession(session: ListingEditorSession, routeId: string | null): ListingEditorSession {
  if (session.routeId === routeId) return session;
  if (session.routeId === null && routeId !== null && routeId === session.createdId) {
    return { ...session, routeId };
  }
  return { routeId, generation: session.generation + 1, createdId: null };
}
