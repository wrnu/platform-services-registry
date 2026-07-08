import {
  CloudCostRulesConfigData,
  DEFAULT_CLOUD_COST_RULES,
  DEFAULT_NOTIFICATION_ROUTING,
} from '@/constants/cloud-cost-rules';
import prisma from '@/core/prisma';
import { CloudCostRulesConfig, ProjectionMethod } from '@/prisma/client';
import type { CloudCostRulesConfigBody } from '@/validation-schemas';

function toVarianceTier(tier: { percentAbove?: number; dollarsAbove?: number; minDollarsAbove?: number }) {
  return {
    percentAbove: tier.percentAbove ?? null,
    dollarsAbove: tier.dollarsAbove ?? null,
    minDollarsAbove: tier.minDollarsAbove ?? null,
  };
}

export function toCloudCostRulesConfigData(body: CloudCostRulesConfigBody): CloudCostRulesConfigData {
  return {
    varianceThresholds: {
      a1: toVarianceTier(body.varianceThresholds.a1),
      a2: toVarianceTier(body.varianceThresholds.a2),
      a3: toVarianceTier(body.varianceThresholds.a3),
    },
    consumptionMilestones: body.consumptionMilestones,
    earlyPaceWarning: {
      percentOfForecast: body.earlyPaceWarning.percentOfForecast,
      byDayOfMonth: body.earlyPaceWarning.byDayOfMonth,
      preemptivePercentOfForecast: body.earlyPaceWarning.preemptivePercentOfForecast ?? null,
      preemptiveByDayOfMonth: body.earlyPaceWarning.preemptiveByDayOfMonth ?? null,
    },
    forecastPolicy: body.forecastPolicy,
    quarterlyReview: body.quarterlyReview,
    reminderPolicy: body.reminderPolicy,
    monthlyRecapDayOfMonth: body.monthlyRecapDayOfMonth,
    projectionMethod: body.projectionMethod ?? ProjectionMethod.LINEAR_EXTRAPOLATION,
    notificationRouting: body.notificationRouting ?? DEFAULT_NOTIFICATION_ROUTING,
  };
}

export function rulesConfigModelToData(config: CloudCostRulesConfig): CloudCostRulesConfigData {
  return {
    varianceThresholds: config.varianceThresholds,
    consumptionMilestones: config.consumptionMilestones,
    earlyPaceWarning: config.earlyPaceWarning,
    forecastPolicy: config.forecastPolicy,
    quarterlyReview: config.quarterlyReview,
    reminderPolicy: config.reminderPolicy,
    monthlyRecapDayOfMonth: config.monthlyRecapDayOfMonth,
    projectionMethod: config.projectionMethod,
    notificationRouting: config.notificationRouting ?? DEFAULT_NOTIFICATION_ROUTING,
  };
}

/** Deactivate the current active config and create the next version as active. */
async function activateNewConfigVersion(data: CloudCostRulesConfigData, createdById?: string) {
  // Run read/deactivate/create in a single transaction so a failure or concurrent write
  // cannot leave the system with no active config or duplicate version numbers.
  return prisma.$transaction(async (tx) => {
    const latest = await tx.cloudCostRulesConfig.findFirst({ orderBy: { version: 'desc' } });
    const version = latest ? latest.version + 1 : 1;

    await tx.cloudCostRulesConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });

    return tx.cloudCostRulesConfig.create({
      data: {
        version,
        isActive: true,
        effectiveAt: new Date(),
        ...data,
        createdById,
      },
    });
  });
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
  return activateNewConfigVersion(toCloudCostRulesConfigData(DEFAULT_CLOUD_COST_RULES));
}

export async function listCloudCostRulesConfigs() {
  return prisma.cloudCostRulesConfig.findMany({ orderBy: { version: 'desc' } });
}

export async function createCloudCostRulesConfig(body: CloudCostRulesConfigBody, userId: string) {
  return activateNewConfigVersion(toCloudCostRulesConfigData(body), userId);
}
