type PricingInput = {
  hourlyRateClp: number;
  hours: number;
  materials: boolean;
  urgency: boolean;
  travelFeeClp: number;
  materialFeeDefaultClp: number;
  urgencyFeeClp: number;
  platformFeePct: number;
};

export type PricingBreakdown = {
  hourlyRateClp: number;
  hours: number;
  subtotalClp: number;
  extrasTotalClp: number;
  platformFeeClp: number;
  totalClp: number;
  extras: Array<{ code: string; name: string; priceClp: number }>;
};

export function calculateMarketplacePrice(input: PricingInput): PricingBreakdown {
  const subtotalClp = input.hourlyRateClp * input.hours;

  const extras: Array<{ code: string; name: string; priceClp: number }> = [];

  if (input.materials && input.materialFeeDefaultClp > 0) {
    extras.push({ code: "materials", name: "Materiales", priceClp: input.materialFeeDefaultClp });
  }

  if (input.urgency && input.urgencyFeeClp > 0) {
    extras.push({ code: "urgency", name: "Urgencia", priceClp: input.urgencyFeeClp });
  }

  if (input.travelFeeClp > 0) {
    extras.push({ code: "travel", name: "Desplazamiento", priceClp: input.travelFeeClp });
  }

  const extrasTotalClp = extras.reduce((sum, item) => sum + item.priceClp, 0);
  const platformFeeClp = Math.round((subtotalClp * input.platformFeePct) / 100);
  const totalClp = subtotalClp + extrasTotalClp + platformFeeClp;

  return {
    hourlyRateClp: input.hourlyRateClp,
    hours: input.hours,
    subtotalClp,
    extrasTotalClp,
    platformFeeClp,
    totalClp,
    extras
  };
}
