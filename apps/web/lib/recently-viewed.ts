/** Guest history stays in this browser; only public listings are resolved by the server. */
const storageKey = "gearboxe-recently-viewed";
const updatedEvent = "gearboxe-recently-viewed-updated";
const limit = 12;
let memoryHistory: string[] = [];
let storageUnavailable = false;

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

export function readLocalViews(): string[] {
  if (typeof window === "undefined") return [];
  if (storageUnavailable) return memoryHistory;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    storageUnavailable = true;
    return memoryHistory;
  }
  if (!raw || raw.length > 4096) return [];
  try {
    const stored: unknown = JSON.parse(raw);
    if (!Array.isArray(stored)) return [];
    return [...new Set(stored.filter(validId))].slice(0, limit);
  } catch {
    return [];
  }
}

export function recordLocalView(id: string): void {
  if (typeof window === "undefined" || !validId(id)) return;
  memoryHistory = [
    id,
    ...readLocalViews().filter((previous) => previous !== id),
  ].slice(0, limit);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(memoryHistory));
  } catch {
    // A browser can disable storage or run out of quota; retain session history.
    storageUnavailable = true;
  }
  window.dispatchEvent(new Event(updatedEvent));
}

/** A primitive snapshot remains stable between reads for useSyncExternalStore. */
export function localViewsSnapshot(): string {
  return JSON.stringify(readLocalViews());
}
export function subscribeLocalViews(update: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) update();
  };
  window.addEventListener(updatedEvent, update);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(updatedEvent, update);
    window.removeEventListener("storage", onStorage);
  };
}
