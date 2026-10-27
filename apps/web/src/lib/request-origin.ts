/** Same-origin check for browser-initiated mutating BFF/auth routes (CSRF). */

export function isSameApplicationOrigin(
  originHeader: string | null,
  applicationUrl: string | undefined,
): boolean {
  if (!originHeader || !applicationUrl) return false;
  try {
    return new URL(originHeader).origin === new URL(applicationUrl).origin;
  } catch {
    return false;
  }
}
