const storageKey = "vehicles:return";
const maxAgeMs = 15 * 60 * 1000;
const maxRestoredCount = 240;

export interface InventoryReturn {
  url: string;
  count: number;
  scrollY: number;
  layout: "grid" | "list";
  savedAt: number;
}

export function saveInventoryReturn(storage: Pick<Storage, "setItem">, value: Omit<InventoryReturn, "savedAt">) {
  storage.setItem(storageKey, JSON.stringify({ ...value, count: Math.min(value.count, maxRestoredCount), savedAt: Date.now() }));
}

export function readInventoryReturn(storage: Pick<Storage, "getItem" | "removeItem">, url: string, now = Date.now()): InventoryReturn | null {
  const raw = storage.getItem(storageKey);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as InventoryReturn;
    if (value.url !== url) return null;
    if (!Number.isInteger(value.count) || value.count < 1 || value.count > maxRestoredCount || !Number.isFinite(value.scrollY) || value.scrollY < 0 ||
      (value.layout !== "grid" && value.layout !== "list") || !Number.isFinite(value.savedAt) || now - value.savedAt > maxAgeMs || value.savedAt > now) {
      storage.removeItem(storageKey);
      return null;
    }
    return value;
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}
