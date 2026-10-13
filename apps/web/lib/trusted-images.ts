// Exact deployment host only. Wildcards would trust other customers' uploads.
const convexHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "").hostname; }
  catch { return ""; }
})();

export function isTrustedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.port && !url.username && !url.password && (
      url.hostname === "images.unsplash.com" ||
      (Boolean(convexHost) && url.hostname === convexHost && url.pathname.startsWith("/api/storage/"))
    );
  } catch { return false; }
}
