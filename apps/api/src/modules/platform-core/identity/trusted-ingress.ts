import { createHmac, timingSafeEqual } from 'node:crypto';

export const VALIDATED_TENANT_HOST_HEADER = 'x-syndes-validated-host';
export const VALIDATED_TENANT_TIME_HEADER = 'x-syndes-validated-at';
export const VALIDATED_TENANT_SIGNATURE_HEADER = 'x-syndes-validated-signature';

export function signValidatedHost(
  host: string,
  timestamp: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${host}.${timestamp}`)
    .digest('hex');
}

export function verifyValidatedHost(
  host: string,
  timestamp: string,
  signature: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (
    !/^[a-z0-9.-]{1,253}$/.test(host) ||
    !/^\d{13}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const issued = Number(timestamp);
  if (!Number.isSafeInteger(issued) || Math.abs(nowMs - issued) > 60_000)
    return false;
  const expected = Buffer.from(
    signValidatedHost(host, timestamp, secret),
    'hex',
  );
  const received = Buffer.from(signature, 'hex');
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
