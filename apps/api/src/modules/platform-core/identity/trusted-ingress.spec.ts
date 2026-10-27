import { signValidatedHost, verifyValidatedHost } from './trusted-ingress';

describe('trusted ingress host assertions', () => {
  const secret =
    'a test-only ingress signing secret that is not a deployment secret';
  it('verifies a signed, fresh, normalized tenant hostname', () => {
    const timestamp = Date.now().toString();
    const signature = signValidatedHost('crm.example.test', timestamp, secret);
    expect(
      verifyValidatedHost('crm.example.test', timestamp, signature, secret),
    ).toBe(true);
  });

  it('rejects client-controlled changes, stale headers, and malformed hosts', () => {
    const timestamp = Date.now().toString();
    const signature = signValidatedHost('crm.example.test', timestamp, secret);
    expect(
      verifyValidatedHost('other.example.test', timestamp, signature, secret),
    ).toBe(false);
    expect(
      verifyValidatedHost(
        'crm.example.test',
        String(Date.now() - 120_000),
        signature,
        secret,
      ),
    ).toBe(false);
    expect(
      verifyValidatedHost(
        'crm.example.test,attacker.test',
        timestamp,
        signature,
        secret,
      ),
    ).toBe(false);
  });
});
