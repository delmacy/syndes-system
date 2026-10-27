import { describe, expect, it } from 'vitest';
import { normalizeTenantHost } from './tenant-host';

describe('normalizeTenantHost', () => {
  it('lowercases a valid hostname for ingress signing', () => {
    expect(normalizeTenantHost('CRM.Example.TEST')).toBe('crm.example.test');
  });

  it('rejects hosts that the API verifier would refuse', () => {
    expect(normalizeTenantHost('')).toBeNull();
    expect(normalizeTenantHost('bad host')).toBeNull();
    expect(normalizeTenantHost('tenant_id.example')).toBeNull();
    expect(normalizeTenantHost('a'.repeat(254))).toBeNull();
  });
});
