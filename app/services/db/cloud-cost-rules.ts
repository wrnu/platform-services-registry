import {
  CloudCostRulesConfigData,
  DEFAULT_CLOUD_COST_RULES,
  DEFAULT_NOTIFICATION_ROUTING,
  previewRuleEvaluation,
  RulePreviewInput,
} from '@/constants/cloud-cost-rules';
import prisma from '@/core/prisma';
import { ProjectionMethod } from '@/prisma/client';
import type { CloudCostRulesConfigBody } from '@/validation-schemas';

export function toCloudCostRulesConfigData(body: CloudCostRulesConfigBody): CloudCostRulesConfigData {
  return {
    varianceThresholds: body.varianceThresholds as CloudCostRulesConfigData['varianceThresholds'],
    consumptionMilestones: body.consumptionMilestones,
    earlyPaceWarning: body.earlyPaceWarning,
    forecastPolicy: body.forecastPolicy,
    quarterlyReview: body.quarterlyReview,
    reminderPolicy: body.reminderPolicy,
    monthlyRecapDayOfMonth: body.monthlyRecapDayOfMonth,
    projectionMethod: (body.projectionMethod ?? ProjectionMethod.LINEAR_EXTRAPOLATION) as ProjectionMethod,
    notificationRouting: body.notificationRouting ?? DEFAULT_NOTIFICATION_ROUTING,
  };
}

export async function getActiveCloudCostRulesConfig() {
  const active = await prisma.cloudCostRulesConfig.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });

  if (active) return active;

  return seedDefaultCloudCostRulesConfig();
}

export async function seedDefaultCloudCostRulesConfig() {
  const latest = await prisma.cloudCostRulesConfig.findFirst({ orderBy: { version: 'desc' } });
  const version = latest ? latest.version + 1 : 1;

  await prisma.cloudCostRulesConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });

  return prisma.cloudCostRulesConfig.create({
    data: {
      version,
      isActive: true,
      effectiveAt: new Date(),
      ...DEFAULT_CLOUD_COST_RULES,
    },
  });
}

export async function listCloudCostRulesConfigs() {
  return prisma.cloudCostRulesConfig.findMany({ orderBy: { version: 'desc' } });
}

export async function createCloudCostRulesConfig(body: CloudCostRulesConfigBody, userId: string) {
  const normalized = toCloudCostRulesConfigData(body);
  const latest = await prisma.cloudCostRulesConfig.findFirst({ orderBy: { version: 'desc' } });
  const version = latest ? latest.version + 1 : 1;

  await prisma.cloudCostRulesConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });

  return prisma.cloudCostRulesConfig.create({
    data: {
      version,
      isActive: true,
      effectiveAt: new Date(),
      varianceThresholds: normalized.varianceThresholds,
      consumptionMilestones: normalized.consumptionMilestones,
      earlyPaceWarning: normalized.earlyPaceWarning,
      forecastPolicy: normalized.forecastPolicy,
      quarterlyReview: normalized.quarterlyReview,
      reminderPolicy: normalized.reminderPolicy,
      monthlyRecapDayOfMonth: normalized.monthlyRecapDayOfMonth,
      projectionMethod: normalized.projectionMethod,
      notificationRouting: normalized.notificationRouting,
      createdById: userId,
    },
  });
}

export function previewCloudCostRules(input: RulePreviewInput, rules: CloudCostRulesConfigData) {
  return previewRuleEvaluation(input, rules);
}
