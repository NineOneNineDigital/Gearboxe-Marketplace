/**
 * Entry-type category colors for Gearboxe
 *
 * The single source of truth for the four logbook entry categories shown in
 * dashboards, charts, badges, and lists. Palette: "Brand + Violet" — anchored
 * on the 2026 brand (Torque, Coral, Chrome) with one harmonized violet accent
 * for Modification. Kept deliberately distinct from the maintenance status
 * trio (Coral=due, Signal=upcoming, Mint=done) so a color never means two
 * things on one screen.
 *
 * Values are theme-aware (light = on Bone, dark = on Midnight).
 */

export type EntryTypeKey = "maintenance" | "repair" | "modification" | "other";

interface EntryTypeColor {
  light: string;
  dark: string;
}

export const entryTypeColors: Record<EntryTypeKey, EntryTypeColor> = {
  /** Maintenance — Torque blue (the core activity, brand hero) */
  maintenance: { light: "#0080FF", dark: "#0080FF" },
  /** Repair — Coral (warm, "something needed fixing") */
  repair: { light: "#FF7A66", dark: "#FF7A66" },
  /** Modification — Violet (saturated enough to separate from Torque blue) */
  modification: { light: "#9B5DE5", dark: "#B17DF5" },
  /** Other — cool intentional slate */
  other: { light: "#8A93A1", dark: "#9BA3AE" },
} as const;

/**
 * Resolve an entry-type color for a given theme. Accepts the capitalized type
 * strings used across the apps ("Maintenance", "Repair", …); unknown types
 * fall back to "other".
 */
export function getEntryTypeColor(
  type: string,
  theme: "light" | "dark"
): string {
  const key = type.toLowerCase() as EntryTypeKey;
  const entry = entryTypeColors[key] ?? entryTypeColors.other;
  return entry[theme];
}

export type EntryTypeColors = typeof entryTypeColors;
