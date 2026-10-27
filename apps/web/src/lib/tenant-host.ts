/** Hostname shape accepted by the API trusted-ingress verifier. */

const HOST_PATTERN = /^[a-z0-9.-]{1,253}$/;

export function normalizeTenantHost(hostname: string): string | null {
  const host = hostname.trim().toLowerCase();
  if (!HOST_PATTERN.test(host)) return null;
  return host;
}
