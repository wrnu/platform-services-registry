import { z } from 'zod';
import { AccountabilityAlertLevel, AccountabilityStatus, Prisma, ProjectionMethod, Provider } from '@/prisma/client';
import { processEnumString } from '@/utils/js';

const billingPeriodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

const providerSchema = z.enum([Provider.AWS, Provider.AWS_LZA, Provider.AZURE]);

const currencySchema = z.enum(['USD', 'CAD']);

export const accountBreakdownSchema = z.object({
  accountId: z.string().min(1),
  environment: z.enum(['dev', 'test', 'prod', 'tools']).optional(),
  spendToDate: z.number().min(0),
  currency: currencySchema,
});

export const cspConsumptionSnapshotSchema = z.object({
  licencePlate: z.string().min(1),
  provider: providerSchema,
  currency: currencySchema,
  billingPeriod: billingPeriodSchema,
  asOf: z.string().datetime(),
  spendToDate: z.number().min(0),
  projectedMonthEnd: z.number().min(0),
  currentMonthForecast: z.number().min(0),
  varianceAmount: z.number(),
  variancePercent: z.number(),
  consumptionPercentOfForecast: z.number(),
  dayOfMonth: z.number().int().min(1).max(31),
  daysInMonth: z.number().int().min(28).max(31),
  accounts: z.array(accountBreakdownSchema).optional(),
});

export const consumptionAlertTypeSchema = z.enum(['MILESTONE', 'PACE', 'A1', 'A2', 'A3']);

export const cspConsumptionAlertSchema = z.object({
  licencePlate: z.string().min(1),
  provider: providerSchema,
  currency: currencySchema,
  billingPeriod: billingPeriodSchema,
  triggeredAt: z.string().datetime(),
  alertType: consumptionAlertTypeSchema,
  milestonePercent: z.number().int().optional(),
  paceDayOfMonth: z.number().int().optional(),
  spendToDate: z.number().min(0),
  projectedMonthEnd: z.number().min(0),
  currentMonthForecast: z.number().min(0),
  varianceAmount: z.number(),
  variancePercent: z.number(),
  consumptionPercentOfForecast: z.number(),
  ruleKey: z.string().optional(),
});

export const cspMonthlyTotalSchema = z.object({
  billingPeriod: billingPeriodSchema,
  currency: currencySchema,
  actualTotal: z.number().min(0),
  forecastTotal: z.number().min(0).optional(),
  varianceAmount: z.number().optional(),
  variancePercent: z.number().optional(),
});

export const cspConsumptionHistorySchema = z.object({
  licencePlate: z.string().min(1),
  provider: providerSchema,
  months: z.array(cspMonthlyTotalSchema).min(1),
});

export const forecastMonthlyValueSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z.number().min(0),
  currency: z.enum(['USD', 'CAD']),
});

export const cloudCostForecastBodySchema = z.object({
  monthlyValues: z.array(forecastMonthlyValueSchema).min(1),
  horizonMonths: z.number().int().min(1).max(36).default(24),
  changeJustification: z.string().min(1).optional(),
  changeNature: z.enum(['ONE_TIME', 'ONGOING']).optional(),
});

export const resolveAlertBodySchema = z.object({
  explanation: z.string().optional(),
  resolutionReason: z.string().min(1),
});

export const acknowledgeAlertBodySchema = z.object({
  explanation: z.string().optional(),
});

export const quarterlyReviewUpdateBodySchema = z.object({
  forecastMonthsAdded: z.boolean().optional(),
  forecastMonthsReviewed: z.boolean().optional(),
  membersReviewed: z.boolean().optional(),
  spendLookbackReviewed: z.boolean().optional(),
  softQrCompleted: z.boolean().optional(),
});

export type CspConsumptionSnapshot = z.infer<typeof cspConsumptionSnapshotSchema>;
export type CspConsumptionAlert = z.infer<typeof cspConsumptionAlertSchema>;
export type CspConsumptionHistory = z.infer<typeof cspConsumptionHistorySchema>;
export type CloudCostForecastBody = z.infer<typeof cloudCostForecastBodySchema>;

export const rejectForecastBodySchema = z.object({
  rejectionReason: z.string().min(1),
});

export type RejectForecastBody = z.infer<typeof rejectForecastBodySchema>;

export const publicCloudAccountabilitySearchBodySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(AccountabilityStatus).optional(),
  statuses: z.array(z.nativeEnum(AccountabilityStatus)).optional(),
  provider: z.nativeEnum(Provider).optional(),
  highestOpenAlert: z.nativeEnum(AccountabilityAlertLevel).optional(),
  onEscalationList: z.boolean().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
  sortValue: z.string().optional(),
  sortKey: z.string().optional(),
  sortOrder: z.preprocess(processEnumString, z.enum(Prisma.SortOrder)).optional(),
});

export type PublicCloudAccountabilitySearchBody = z.infer<typeof publicCloudAccountabilitySearchBodySchema>;

export const accountabilityNotificationSearchBodySchema = z.object({
  licencePlate: z.string().optional(),
  templateKey: z.string().optional(),
  search: z.string().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
});

export type AccountabilityNotificationSearchBody = z.infer<typeof accountabilityNotificationSearchBodySchema>;

export const accountabilityExportBodySchema = z.object({
  provider: z.nativeEnum(Provider).optional(),
  format: z.enum(['csv', 'xlsx']).optional().default('xlsx'),
});

export const accountabilityExportQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx']).optional().default('xlsx'),
});

export type AccountabilityExportBody = z.infer<typeof accountabilityExportBodySchema>;
export type AccountabilityExportQuery = z.infer<typeof accountabilityExportQuerySchema>;

const varianceThresholdTierSchema = z.object({
  percentAbove: z.number().optional(),
  dollarsAbove: z.number().optional(),
  minDollarsAbove: z.number().optional(),
});

export const cloudCostRulesConfigBodySchema = z.object({
  varianceThresholds: z.object({
    a1: varianceThresholdTierSchema,
    a2: varianceThresholdTierSchema,
    a3: varianceThresholdTierSchema,
  }),
  consumptionMilestones: z.object({
    tiers: z.array(z.number().int().min(1)).min(1),
    stepPercent: z.number().int().min(1),
  }),
  earlyPaceWarning: z.object({
    percentOfForecast: z.number().min(0),
    byDayOfMonth: z.number().int().min(1).max(31),
    preemptivePercentOfForecast: z.number().min(0).optional(),
    preemptiveByDayOfMonth: z.number().int().min(1).max(31).optional(),
  }),
  forecastPolicy: z.object({
    horizonMonths: z.number().int().min(1).max(36),
    quarterStartMonths: z.array(z.number().int().min(1).max(12)).min(1),
  }),
  quarterlyReview: z.object({
    softQrRequired: z.boolean(),
    spendLookbackMonths: z.number().int().min(1).max(12),
    poSignOffRequired: z.boolean(),
  }),
  reminderPolicy: z.object({
    weeklyUntilSignOff: z.boolean(),
    escalateAtMPlusOne: z.boolean(),
  }),
  monthlyRecapDayOfMonth: z.number().int().min(1).max(28),
  projectionMethod: z.nativeEnum(ProjectionMethod).optional(),
  notificationRouting: z
    .object({
      a1AdminEmails: z.array(z.string()),
      a2AdminEmails: z.array(z.string()),
      a3AdminEmails: z.array(z.string()),
      escalationEmails: z.array(z.string()),
      monthlyRecapEmails: z.array(z.string()),
      nonComplianceEmails: z.array(z.string()),
      escalationListEmails: z.array(z.string()),
    })
    .optional(),
});

export const cloudCostRulesPreviewBodySchema = z.object({
  forecastAmount: z.number().min(0),
  spendToDate: z.number().min(0),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  rules: cloudCostRulesConfigBodySchema.optional(),
});

export type CloudCostRulesConfigBody = z.infer<typeof cloudCostRulesConfigBodySchema>;
