import { notFound, redirect } from "next/navigation";

export function redirectToPublicSite(path: string) {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined);
  if (!origin) notFound();
  const url = new URL(origin);
  if ((url.protocol !== "https:" && !(process.env.NODE_ENV === "development" && url.protocol === "http:")) || url.username || url.password || url.pathname !== "/") notFound();
  redirect(new URL(path, url).href);
}
