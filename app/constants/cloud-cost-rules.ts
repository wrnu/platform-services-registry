import {
  AccountabilityAlertLevel,
  CloudCostConsumptionMilestones,
  CloudCostEarlyPaceWarning,
  CloudCostForecastPolicy,
  CloudCostQuarterlyReviewPolicy,
  CloudCostReminderPolicy,
  CloudCostVarianceThresholds,
  ProjectionMethod,
} from '@/prisma/client';

export const DEFAULT_CLOUD_COST_RULES = {
  varianceThresholds: {
    a1: { percentAbove: 10 },
    a2: { percentAbove: 50, dollarsAbove: 500 },
    a3: { percentAbove: 200, minDollarsAbove: 500, dollarsAbove: 2000 },
  },
  consumptionMilestones: { tiers: [50, 80, 100], stepPercent: 25 },
  earlyPaceWarning: { percentOfForecast: 50, byDayOfMonth: 10 },
  forecastPolicy: { horizonMonths: 24, quarterStartMonths: [1, 4, 7, 10] },
  quarterlyReview: { softQrRequired: true, spendLookbackMonths: 3, poSignOffRequired: true },
  reminderPolicy: { weeklyUntilSignOff: true, escalateAtMPlusOne: true },
  monthlyRecapDayOfMonth: 1,
  projectionMethod: ProjectionMethod.LINEAR_EXTRAPOLATION,
};

export type CloudCostRulesConfigData = {
  varianceThresholds: CloudCostVarianceThresholds;
  consumptionMilestones: CloudCostConsumptionMilestones;
  earlyPaceWarning: CloudCostEarlyPaceWarning;
  forecastPolicy: CloudCostForecastPolicy;
  quarterlyReview: CloudCostQuarterlyReviewPolicy;
  reminderPolicy: CloudCostReminderPolicy;
  monthlyRecapDayOfMonth: number;
  projectionMethod: ProjectionMethod;
};

export function evaluateVarianceAlertLevel(
  forecast: number,
  spend: number,
  thresholds: CloudCostVarianceThresholds,
): AccountabilityAlertLevel | null {
  if (forecast <= 0) return null;

  const varianceAmount = spend - forecast;
  const variancePercent = (varianceAmount / forecast) * 100;

  const { a3, a2, a1 } = thresholds;
  if (
    (a3.percentAbove != null && variancePercent > a3.percentAbove && varianceAmount >= (a3.minDollarsAbove ?? 0)) ||
    (a3.dollarsAbove != null && varianceAmount > a3.dollarsAbove)
  ) {
    return AccountabilityAlertLevel.A3;
  }
  if (
    (a2.percentAbove != null && variancePercent > a2.percentAbove) ||
    (a2.dollarsAbove != null && varianceAmount > a2.dollarsAbove)
  ) {
    return AccountabilityAlertLevel.A2;
  }
  if (a1.percentAbove != null && variancePercent > a1.percentAbove) {
    return AccountabilityAlertLevel.A1;
  }

  return null;
}

export function evaluatePaceWarning(
  forecast: number,
  spend: number,
  dayOfMonth: number,
  pace: CloudCostEarlyPaceWarning,
): boolean {
  if (forecast <= 0 || dayOfMonth > pace.byDayOfMonth) return false;
  return (spend / forecast) * 100 >= pace.percentOfForecast;
}

export function evaluateMilestonePercent(
  forecast: number,
  spend: number,
  milestones: CloudCostConsumptionMilestones,
): number | null {
  if (forecast <= 0) return null;

  const consumptionPercent = (spend / forecast) * 100;
  let highest: number | null = null;

  for (const tier of milestones.tiers) {
    if (consumptionPercent >= tier) highest = tier;
  }

  if (consumptionPercent > 100) {
    const beyond = Math.floor((consumptionPercent - 100) / milestones.stepPercent) * milestones.stepPercent + 100;
    if (beyond > (highest ?? 0)) highest = beyond;
  }

  return highest;
}

export type RulePreviewInput = {
  forecastAmount: number;
  spendToDate: number;
  dayOfMonth?: number;
};

export type RulePreviewResult = {
  varianceLevel: AccountabilityAlertLevel | null;
  paceWarning: boolean;
  milestonePercent: number | null;
  varianceAmount: number;
  variancePercent: number;
  consumptionPercent: number;
};

export function previewRuleEvaluation(input: RulePreviewInput, rules: CloudCostRulesConfigData): RulePreviewResult {
  const { forecastAmount, spendToDate, dayOfMonth = 1 } = input;
  const varianceAmount = spendToDate - forecastAmount;
  const variancePercent = forecastAmount > 0 ? (varianceAmount / forecastAmount) * 100 : 0;
  const consumptionPercent = forecastAmount > 0 ? (spendToDate / forecastAmount) * 100 : 0;

  return {
    varianceLevel: evaluateVarianceAlertLevel(forecastAmount, spendToDate, rules.varianceThresholds),
    paceWarning: evaluatePaceWarning(forecastAmount, spendToDate, dayOfMonth, rules.earlyPaceWarning),
    milestonePercent: evaluateMilestonePercent(forecastAmount, spendToDate, rules.consumptionMilestones),
    varianceAmount,
    variancePercent,
    consumptionPercent,
  };
}
