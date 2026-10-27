import { describe, expect, it } from "vitest";
import {
  containsTenantSelector,
  isTenantSelectorName,
} from "./tenant-selector";

describe("tenant selector rejection at the BFF boundary", () => {
  it("recognizes selector spellings without blocking ordinary business fields", () => {
    expect(isTenantSelectorName("tenant_id")).toBe(true);
    expect(isTenantSelectorName("x-database-name")).toBe(true);
    expect(isTenantSelectorName("customer_name")).toBe(false);
  });

  it("rejects nested selector payloads and excessive nesting", () => {
    expect(
      containsTenantSelector({ filters: [{ databaseName: "tenant-b-db" }] }),
    ).toBe(true);
    let nested: Record<string, unknown> = {};
    for (let index = 0; index < 34; index += 1) nested = { child: nested };
    expect(containsTenantSelector(nested)).toBe(true);
  });
});
