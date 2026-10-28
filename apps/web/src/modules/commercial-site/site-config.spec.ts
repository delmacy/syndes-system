import { describe, expect, it } from "vitest";
import { commercialSite } from "./site-config";

describe("commercial site product facts", () => {
  it("keeps the approved introductory pricing", () => {
    expect(commercialSite.pricing.introMonths).toBe(2);
    expect(commercialSite.pricing.introMonthly).toBe(69.9);
    expect(commercialSite.pricing.regularMonthly).toBe(129.99);
  });

  it("keeps subscription access tied to 30 paid days", () => {
    expect(commercialSite.paymentPeriodDays).toBe(30);
  });

  it("does not present the introductory price as the permanent price", () => {
    expect(commercialSite.pricing.regularMonthly).toBeGreaterThan(
      commercialSite.pricing.introMonthly,
    );
  });
});
