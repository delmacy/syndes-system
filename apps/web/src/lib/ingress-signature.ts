import { createHmac } from 'node:crypto';

export function signTenantHost(host: string, timestamp: string, secret: string) {
  return {
    'x-syndes-validated-host': host,
    'x-syndes-validated-at': timestamp,
    'x-syndes-validated-signature': createHmac('sha256', secret).update(`${host}.${timestamp}`).digest('hex'),
  };
}
