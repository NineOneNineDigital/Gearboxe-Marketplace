const DEV_PREVIEW_ORIGIN = "https://dev-gearboxe-marketplace.vercel.app";

type OriginEnvironment = { APP_URL?: string; DEV_PREVIEW_APP_URL?: string; MARKETPLACE_ENV?: string };

// The shared development backend can serve localhost and one explicitly
// configured Preview. A bad Preview value fails closed instead of widening CORS.
export function allowedHttpOrigin(origin: string | null, env: OriginEnvironment, allowMissingOrigin = false) {
  let appOrigin: string;
  try { appOrigin = new URL(env.APP_URL || "").origin; }
  catch { return null; }
  if (appOrigin === "null") return null;

  const origins = [appOrigin];
  if (env.DEV_PREVIEW_APP_URL !== undefined) {
    if (env.MARKETPLACE_ENV !== "development" || appOrigin !== "http://localhost:3000" ||
        env.DEV_PREVIEW_APP_URL !== DEV_PREVIEW_ORIGIN)
      return null;
    origins.push(DEV_PREVIEW_ORIGIN);
  }
  if (origin === null) return allowMissingOrigin ? appOrigin : null;
  return origins.includes(origin) ? origin : null;
}
