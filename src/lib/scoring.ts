import {
  SCORE_WEIGHTS,
  type CategoryScore,
  type MatchStatus,
  type Recommendation,
  type RequirementMatch,
  type ScoreBreakdown,
  type ScoreCategory,
} from "@/lib/types";

export const CATEGORIES = Object.keys(SCORE_WEIGHTS) as ScoreCategory[];

export function pointsForStatus(status: MatchStatus): number {
  if (status === "strong_match") return 1;
  if (status === "partial_match") return 0.5;
  return 0;
}

export function scoreCategory(items: Pick<RequirementMatch, "status">[], maxPoints: number): number {
  if (items.length === 0) return 0;
  const unit = maxPoints / items.length;
  return items.reduce((sum, item) => sum + unit * pointsForStatus(item.status), 0);
}

export function recommendationFromScore(score: number): Recommendation {
  if (score >= 80) return "strong_fit";
  if (score >= 55) return "possible_fit";
  return "weak_fit";
}

export function computeScore(
  categories: Record<ScoreCategory, Pick<RequirementMatch, "status">[]>
): ScoreBreakdown {
  const present = CATEGORIES.filter((key) => categories[key].length > 0);
  const weightSum = present.reduce((sum, key) => sum + SCORE_WEIGHTS[key], 0) || 100;

  const breakdown = {} as Record<ScoreCategory, CategoryScore>;
  let earnedPresent = 0;

  for (const key of CATEGORIES) {
    const max = SCORE_WEIGHTS[key];
    const items = categories[key];
    if (items.length === 0) {
      breakdown[key] = { earned: 0, max, na: true };
      continue;
    }
    const earned = scoreCategory(items, max);
    breakdown[key] = { earned: round1(earned), max, na: false };
    earnedPresent += earned;
  }

  const total = Math.max(0, Math.min(100, Math.round((earnedPresent / weightSum) * 100)));
  return { ...breakdown, total };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
