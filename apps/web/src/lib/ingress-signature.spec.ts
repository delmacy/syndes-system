import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signTenantHost } from './ingress-signature';

describe('tenant routing assertion headers', () => {
  it('signs the host and timestamp without accepting a caller-provided tenant selector', () => {
    const headers = signTenantHost(
      'crm.example.test',
      '1793123456789',
      'test-only-secret',
    );
    expect(headers['x-syndes-validated-host']).toBe('crm.example.test');
    expect(headers['x-syndes-validated-at']).toBe('1793123456789');
    expect(headers['x-syndes-validated-signature']).toBe(
      createHmac('sha256', 'test-only-secret')
        .update('crm.example.test.1793123456789')
        .digest('hex'),
    );
    expect(headers).not.toHaveProperty('tenant-id');
    expect(headers).not.toHaveProperty('database-name');
    expect(headers).not.toHaveProperty('x-tenant-id');
  });
});
