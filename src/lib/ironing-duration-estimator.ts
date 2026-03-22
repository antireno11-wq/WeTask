export type IroningLoadBand = "small" | "medium" | "large" | "xlarge";

export type IroningDurationInput = {
  garments: number;
  bulkyItems: number;
  includesDelicates: boolean;
};

export type IroningDurationEstimate = {
  minHours: number;
  maxHours: number;
  recommendedHours: number;
  summary: string;
  loadBand: IroningLoadBand;
};

export const IRONING_LOAD_OPTIONS: Array<{ value: IroningLoadBand; label: string; helper: string }> = [
  { value: "small", label: "Carga pequeña", helper: "Hasta 12 prendas" },
  { value: "medium", label: "Carga mediana", helper: "13 a 25 prendas" },
  { value: "large", label: "Carga grande", helper: "26 a 40 prendas" },
  { value: "xlarge", label: "Carga muy grande", helper: "Más de 40 prendas" }
];

function roundHalf(value: number) {
  return Math.max(1, Math.round(value * 2) / 2);
}

export function estimateIroningDuration(input: IroningDurationInput): IroningDurationEstimate {
  const garmentHours = input.garments * 0.06;
  const bulkyHours = input.bulkyItems * 0.18;
  const delicateExtra = input.includesDelicates ? 0.4 : 0;
  const base = 0.9 + garmentHours + bulkyHours + delicateExtra;

  const minHours = roundHalf(Math.max(1, base - 0.4));
  const maxHours = roundHalf(Math.max(minHours + 0.5, base + 0.4));
  const recommendedHours = Math.max(1, Math.ceil((minHours + maxHours) / 2));

  let loadBand: IroningLoadBand = "small";
  if (input.garments > 40) loadBand = "xlarge";
  else if (input.garments > 25) loadBand = "large";
  else if (input.garments > 12) loadBand = "medium";

  return {
    minHours,
    maxHours,
    recommendedHours,
    summary: `Para esta carga te recomendamos reservar ${recommendedHours} hora(s) de planchado.`,
    loadBand
  };
}
