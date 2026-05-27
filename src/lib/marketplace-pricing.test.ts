import { describe, expect, it } from "vitest";
import { calculateMarketplacePrice } from "./marketplace-pricing";

describe("calculateMarketplacePrice", () => {
  it("calcula subtotal por horas en modo hourly", () => {
    const price = calculateMarketplacePrice({
      hourlyRateClp: 10000,
      hours: 3,
      materials: false,
      urgency: false,
      travelFeeClp: 0,
      materialFeeDefaultClp: 5000,
      urgencyFeeClp: 3000,
      platformFeePct: 10
    });
    expect(price.subtotalClp).toBe(30000);
    expect(price.extrasTotalClp).toBe(0);
    expect(price.platformFeeClp).toBe(3000); // 10% de 30000
    expect(price.totalClp).toBe(33000);
    expect(price.extras).toHaveLength(0);
  });

  it("usa flat fee cuando pricingModel es fixed", () => {
    const price = calculateMarketplacePrice({
      hourlyRateClp: 25000,
      hours: 4, // se ignoran las hours en fixed
      pricingModel: "fixed",
      materials: false,
      urgency: false,
      travelFeeClp: 0,
      materialFeeDefaultClp: 0,
      urgencyFeeClp: 0,
      platformFeePct: 12
    });
    expect(price.subtotalClp).toBe(25000);
    expect(price.platformFeeClp).toBe(3000); // 12% de 25000
    expect(price.totalClp).toBe(28000);
  });

  it("agrega extra de materiales cuando applies y el default > 0", () => {
    const price = calculateMarketplacePrice({
      hourlyRateClp: 8000,
      hours: 2,
      materials: true,
      urgency: false,
      travelFeeClp: 0,
      materialFeeDefaultClp: 5000,
      urgencyFeeClp: 0,
      platformFeePct: 10
    });
    expect(price.extras).toEqual([{ code: "materials", name: "Materiales", priceClp: 5000 }]);
    expect(price.subtotalClp).toBe(16000);
    expect(price.extrasTotalClp).toBe(5000);
    expect(price.totalClp).toBe(16000 + 5000 + 1600);
  });

  it("NO agrega material extra si el default es 0", () => {
    const price = calculateMarketplacePrice({
      hourlyRateClp: 8000,
      hours: 2,
      materials: true,
      urgency: false,
      travelFeeClp: 0,
      materialFeeDefaultClp: 0,
      urgencyFeeClp: 0,
      platformFeePct: 10
    });
    expect(price.extras).toEqual([]);
    expect(price.extrasTotalClp).toBe(0);
  });

  it("acumula materials + urgency + travel", () => {
    const price = calculateMarketplacePrice({
      hourlyRateClp: 10000,
      hours: 1,
      materials: true,
      urgency: true,
      travelFeeClp: 2500,
      materialFeeDefaultClp: 5000,
      urgencyFeeClp: 3000,
      platformFeePct: 10
    });
    expect(price.extras.map((e) => e.code)).toEqual(["materials", "urgency", "travel"]);
    expect(price.extrasTotalClp).toBe(5000 + 3000 + 2500);
    expect(price.platformFeeClp).toBe(1000);
    expect(price.totalClp).toBe(10000 + 10500 + 1000);
  });

  it("redondea el fee de plataforma (no float)", () => {
    const price = calculateMarketplacePrice({
      hourlyRateClp: 13333,
      hours: 1,
      materials: false,
      urgency: false,
      travelFeeClp: 0,
      materialFeeDefaultClp: 0,
      urgencyFeeClp: 0,
      platformFeePct: 7.5
    });
    // 13333 * 0.075 = 999.975, round → 1000
    expect(price.platformFeeClp).toBe(1000);
    expect(price.totalClp).toBe(13333 + 1000);
  });

  it("acepta fee de 0%", () => {
    const price = calculateMarketplacePrice({
      hourlyRateClp: 10000,
      hours: 1,
      materials: false,
      urgency: false,
      travelFeeClp: 0,
      materialFeeDefaultClp: 0,
      urgencyFeeClp: 0,
      platformFeePct: 0
    });
    expect(price.platformFeeClp).toBe(0);
    expect(price.totalClp).toBe(10000);
  });
});
