export function adminAppOrigin(value: string | undefined, localPort: number) {
  const candidate = value?.trim() || (process.env.NODE_ENV === "development" ? `http://localhost:${localPort}` : "");
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const local = process.env.NODE_ENV === "development" &&
      ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:";
    if ((!local && url.protocol !== "https:") || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}
