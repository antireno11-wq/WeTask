export type TechnicianScoreInput = {
  hasIdentityDocument: boolean;
  hasIdentitySelfie: boolean;
  hasCriminalRecord: boolean;
  yearsExperience: number;
  portfolioCount: number;
  certificationsCount: number;
  hasReferences: boolean;
};

export function calculateTechnicianScore(input: TechnicianScoreInput): number {
  let score = 0;

  if (input.hasIdentityDocument && input.hasIdentitySelfie) score += 20;
  if (input.hasCriminalRecord) score += 30;
  if (input.yearsExperience > 5) score += 15;
  if (input.portfolioCount >= 3) score += 10;
  if (input.certificationsCount > 0) score += 15;
  if (input.hasReferences) score += 10;

  return Math.max(0, Math.min(100, score));
}
