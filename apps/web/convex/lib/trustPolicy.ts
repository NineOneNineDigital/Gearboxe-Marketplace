export const TRUST_REASON_CODES = ["spam", "scam", "harassment", "unsafe_content", "false_information", "stolen_vehicle", "privacy", "other"] as const;
export const RATE_LIMITS = {
    favorite: { count: 60, windowMs: 60_000 },
  message: { count: 30, windowMs: 60000 },
    conversation: { count: 10, windowMs: 3600000 },
    listing: { count: 5, windowMs: 86400000 },
    report: { count: 10, windowMs: 3600000 },
    support: { count: 5, windowMs: 86400000 },
    document: { count: 5, windowMs: 86400000 },
} as const;
export const DOCUMENT_RETENTION_MS = 30 * 86400000;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export function trustText(value: string, label: string, max = 2000) {
    const text = value.trim();
    if (!text || text.length > max)
        throw new Error(`${label} must contain 1–${max} characters`);
    return text;
}
export function trustReason(value: string) {
    if (!TRUST_REASON_CODES.includes(value as typeof TRUST_REASON_CODES[number]))
        throw new Error("Choose a valid moderation reason code");
    return value;
}
export function rateWindow(now: number, windowMs: number) { return Math.floor(now / windowMs) * windowMs; }
export function suspiciousIndicators(input: {
    accountAgeMs: number;
    openReports: number;
    emailVerified?: boolean;
    phoneVerified?: boolean;
}) {
    return [input.accountAgeMs < 86400000 ? "new_account" : null, input.openReports >= 3 ? "repeated_reports" : null,
        !input.emailVerified ? "email_unverified" : null, !input.phoneVerified ? "phone_unverified" : null].filter((value): value is string => value !== null);
}
