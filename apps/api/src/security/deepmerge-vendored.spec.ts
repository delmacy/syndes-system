import deepmerge from 'deepmerge';

describe('vendored deepmerge prototype guard', () => {
  it('rejects __proto__ from sources merged into null-prototype targets', () => {
    const target = Object.create(null) as Record<string, unknown>;
    const source = JSON.parse('{"__proto__":{"isAdmin":true}}') as Record<
      string,
      unknown
    >;

    const result = deepmerge(target, source) as Record<string, unknown>;

    expect(result.isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it('rejects nested __proto__ from sources merged over null placeholders', () => {
    const source = JSON.parse('{"session":{"__proto__":{"isAdmin":true}}}') as {
      session: Record<string, unknown>;
    };

    const result = deepmerge({ session: null }, source) as {
      session: Record<string, unknown>;
    };

    expect(result.session.isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(result.session)).toBe(Object.prototype);
  });

  it('does not copy an own __proto__ key from the target', () => {
    const target = JSON.parse('{"__proto__":{"isAdmin":true}}') as Record<
      string,
      unknown
    >;

    const result = deepmerge(target, {}) as Record<string, unknown>;

    expect(result.isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});
