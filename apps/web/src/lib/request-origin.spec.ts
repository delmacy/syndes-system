import { describe, expect, it } from 'vitest';
import { isSameApplicationOrigin } from './request-origin';

describe('isSameApplicationOrigin', () => {
  it('accepts an exact same origin as AUTH_URL', () => {
    expect(
      isSameApplicationOrigin(
        'https://crm.example.test',
        'https://crm.example.test',
      ),
    ).toBe(true);
  });

  it('rejects missing, cross-origin, or malformed origins', () => {
    expect(
      isSameApplicationOrigin(null, 'https://crm.example.test'),
    ).toBe(false);
    expect(
      isSameApplicationOrigin(
        'https://evil.example',
        'https://crm.example.test',
      ),
    ).toBe(false);
    expect(
      isSameApplicationOrigin('not-a-url', 'https://crm.example.test'),
    ).toBe(false);
    expect(isSameApplicationOrigin('https://crm.example.test', undefined)).toBe(
      false,
    );
  });
});
