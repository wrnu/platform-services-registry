import {
  buildFiscalForecastMonths,
  FISCAL_FORECAST_YEARS,
  mergeMonthlyValuesOntoFiscalHorizon,
  monthKey,
  preserveLockedPastMonthlyValues,
  isForecastHorizonComplete,
  type MonthlyValue,
} from '@/components/public-cloud/accountability/forecast-grid-utils';
import prisma from '@/core/prisma';
import { getCurrentBillingPeriod, getCurrentQuarter, getMPlusOneDate } from '@/helpers/accountability-periods';
import { parsePaginationParams } from '@/helpers/pagination';
import {
  AccountabilityAlertLevel,
  AccountabilityAlertStatus,
  AccountabilityStatus,
  CloudCostForecastStatus,
  Prisma,
  Provider,
  ProjectStatus,
  QuarterlyReviewStatus,
} from '@/prisma/client';
import type {
  CspConsumptionAlert,
  CspConsumptionHistory,
  CspConsumptionSnapshot,
} from '@/validation-schemas/cloud-cost';

export async function getActiveApprovedForecast(licencePlate: string) {
  return prisma.cloudCostForecast.findFirst({
    where: { licencePlate, status: CloudCostForecastStatus.APPROVED },
    orderBy: { version: 'desc' },
  });
}

const PROVIDER_FORECAST_CURRENCY: Record<Provider, 'USD' | 'CAD'> = {
  [Provider.AWS]: 'USD',
  [Provider.AWS_LZA]: 'USD',
  [Provider.AZURE]: 'CAD',
};

/**
 * Platform-wide forecast rollup for the governance dashboard: sums the latest
 * approved forecast of every active public cloud product per month. AWS
 * forecasts are USD and Azure forecasts are CAD, so totals are grouped by
 * currency rather than combined into a single (meaningless) number.
 */
export async function getPlatformForecastSummary() {
  const products = await prisma.publicCloudProduct.findMany({
    where: { status: ProjectStatus.ACTIVE },
    select: { licencePlate: true, provider: true },
  });

  const approvedForecasts = await prisma.cloudCostForecast.findMany({
    where: {
      licencePlate: { in: products.map((p) => p.licencePlate) },
      status: CloudCostForecastStatus.APPROVED,
    },
    orderBy: { version: 'desc' },
    select: { licencePlate: true, monthlyValues: true },
  });

  // Ordered by version desc, so the first forecast seen per plate is the active one.
  const activeForecastByPlate = new Map<string, MonthlyValue[]>();
  for (const forecast of approvedForecasts) {
    if (!activeForecastByPlate.has(forecast.licencePlate)) {
      activeForecastByPlate.set(forecast.licencePlate, forecast.monthlyValues as MonthlyValue[]);
    }
  }

  type CurrencyGroup = {
    currency: 'USD' | 'CAD';
    providers: Set<Provider>;
    productCount: number;
    forecastCount: number;
    totalsByMonth: Map<string, MonthlyValue>;
  };
  const groups = new Map<'USD' | 'CAD', CurrencyGroup>();

  for (const product of products) {
    const currency = PROVIDER_FORECAST_CURRENCY[product.provider];
    let group = groups.get(currency);
    if (!group) {
      group = { currency, providers: new Set(), productCount: 0, forecastCount: 0, totalsByMonth: new Map() };
      groups.set(currency, group);
    }
    group.providers.add(product.provider);
    group.productCount += 1;

    const monthlyValues = activeForecastByPlate.get(product.licencePlate);
    if (!monthlyValues) continue;
    group.forecastCount += 1;

    for (const value of monthlyValues) {
      const key = monthKey(value.year, value.month);
      const existing = group.totalsByMonth.get(key);
      if (existing) {
        existing.amount += value.amount;
      } else {
        group.totalsByMonth.set(key, { year: value.year, month: value.month, amount: value.amount, currency });
      }
    }
  }

  return {
    totalProducts: products.length,
    productsWithForecast: activeForecastByPlate.size,
    groups: [...groups.values()]
      .sort((a, b) => a.currency.localeCompare(b.currency))
      .map((group) => ({
        currency: group.currency,
        providers: [...group.providers].sort(),
        productCount: group.productCount,
        forecastCount: group.forecastCount,
        monthlyTotals: mergeMonthlyValuesOntoFiscalHorizon(
          [...group.totalsByMonth.values()],
          FISCAL_FORECAST_YEARS,
          group.currency,
        ),
      })),
  };
}

export type PlatformForecastSummary = Awaited<ReturnType<typeof getPlatformForecastSummary>>;

export function getForecastAmountForMonth(
  forecast: { monthlyValues: { year: number; month: number; amount: number }[] } | null,
  year: number,
  month: number,
) {
  if (!forecast) return 0;
  const entry = forecast.monthlyValues.find((v) => v.year === year && v.month === month);
  return entry?.amount ?? 0;
}

export async function upsertConsumptionSnapshot(data: CspConsumptionSnapshot) {
  const { year, month } = data.billingPeriod;
  const asOfDate = new Date(data.asOf);

  const product = await prisma.publicCloudProduct.findFirst({
    where: { licencePlate: data.licencePlate },
  });
  if (!product) {
    throw new Error(`Unknown licence plate: ${data.licencePlate}`);
  }

  const snapshotData = {
    licencePlate: data.licencePlate,
    provider: data.provider,
    periodYear: year,
    periodMonth: month,
    currency: data.currency,
    amountToDate: data.spendToDate,
    projectedMonthEnd: data.projectedMonthEnd,
    forecastAmount: data.currentMonthForecast,
    varianceAmount: data.varianceAmount,
    variancePercent: data.variancePercent,
    consumptionPercent: data.consumptionPercentOfForecast,
    dayOfMonth: data.dayOfMonth,
    daysInMonth: data.daysInMonth,
    asOfDate,
    accounts: data.accounts ?? [],
  };

  const snapshot = await prisma.cloudSpendSnapshot.upsert({
    where: {
      licencePlate_periodYear_periodMonth: {
        licencePlate: data.licencePlate,
        periodYear: year,
        periodMonth: month,
      },
    },
    create: snapshotData,
    update: snapshotData,
  });

  await recomputeAccountabilityState(data.licencePlate);
  return snapshot;
}

export async function recordConsumptionAlert(data: CspConsumptionAlert) {
  const { year, month } = data.billingPeriod;
  const triggeredAt = new Date(data.triggeredAt);

  const product = await prisma.publicCloudProduct.findFirst({
    where: { licencePlate: data.licencePlate },
  });
  if (!product) {
    throw new Error(`Unknown licence plate: ${data.licencePlate}`);
  }

  const activeForecast = await getActiveApprovedForecast(data.licencePlate);

  const existingOpen = await prisma.accountabilityAlert.findFirst({
    where: {
      licencePlate: data.licencePlate,
      level: data.alertType as AccountabilityAlertLevel,
      periodYear: year,
      periodMonth: month,
      milestonePercent: data.milestonePercent ?? undefined,
      status: { in: [AccountabilityAlertStatus.OPEN, AccountabilityAlertStatus.ACKNOWLEDGED] },
    },
  });

  if (existingOpen) {
    return prisma.accountabilityAlert.update({
      where: { id: existingOpen.id },
      data: {
        triggeredAt,
        spendToDate: data.spendToDate,
        projectedMonthEnd: data.projectedMonthEnd,
        forecastAmount: data.currentMonthForecast,
        varianceAmount: data.varianceAmount,
        variancePercent: data.variancePercent,
        consumptionPercent: data.consumptionPercentOfForecast,
        cspRuleKey: data.ruleKey,
        paceDayOfMonth: data.paceDayOfMonth,
      },
    });
  }

  const alert = await prisma.accountabilityAlert.create({
    data: {
      licencePlate: data.licencePlate,
      level: data.alertType as AccountabilityAlertLevel,
      milestonePercent: data.milestonePercent,
      paceDayOfMonth: data.paceDayOfMonth,
      triggeredAt,
      periodYear: year,
      periodMonth: month,
      spendToDate: data.spendToDate,
      projectedMonthEnd: data.projectedMonthEnd,
      forecastAmount: data.currentMonthForecast,
      varianceAmount: data.varianceAmount,
      variancePercent: data.variancePercent,
      consumptionPercent: data.consumptionPercentOfForecast,
      cspRuleKey: data.ruleKey,
      forecastId: activeForecast?.id,
    },
  });

  await recomputeAccountabilityState(data.licencePlate);
  return alert;
}

export async function upsertConsumptionHistory(data: CspConsumptionHistory) {
  const product = await prisma.publicCloudProduct.findFirst({
    where: { licencePlate: data.licencePlate },
  });
  if (!product) {
    throw new Error(`Unknown licence plate: ${data.licencePlate}`);
  }

  const months = data.months.map((m) => ({
    year: m.billingPeriod.year,
    month: m.billingPeriod.month,
    currency: m.currency,
    actualTotal: m.actualTotal,
    forecastTotal: m.forecastTotal,
    varianceAmount: m.varianceAmount,
    variancePercent: m.variancePercent,
  }));

  return prisma.cloudSpendHistory.upsert({
    where: {
      licencePlate_provider: {
        licencePlate: data.licencePlate,
        provider: data.provider,
      },
    },
    create: {
      licencePlate: data.licencePlate,
      provider: data.provider,
      months,
    },
    update: { months },
  });
}

export async function recomputeAccountabilityState(licencePlate: string) {
  const activeForecast = await getActiveApprovedForecast(licencePlate);
  const openAlerts = await prisma.accountabilityAlert.findMany({
    where: {
      licencePlate,
      status: { in: [AccountabilityAlertStatus.OPEN, AccountabilityAlertStatus.ACKNOWLEDGED] },
    },
  });

  const levelRank: Record<AccountabilityAlertLevel, number> = {
    MILESTONE: 0,
    PACE: 1,
    A1: 2,
    A2: 3,
    A3: 4,
  };

  let highestOpenAlert: AccountabilityAlertLevel | null = null;
  for (const alert of openAlerts) {
    if (!highestOpenAlert || levelRank[alert.level] > levelRank[highestOpenAlert]) {
      highestOpenAlert = alert.level;
    }
  }

  let status: AccountabilityStatus = AccountabilityStatus.COMPLIANT;

  if (!activeForecast) {
    status = AccountabilityStatus.FORECAST_REQUIRED;
  } else if (
    !isForecastHorizonComplete(
      activeForecast.monthlyValues as { year: number; month: number; amount: number; currency: string }[],
      activeForecast.horizonMonths,
    )
  ) {
    status = AccountabilityStatus.FORECAST_REVIEW_REQUIRED;
  } else if (openAlerts.some((a) => levelRank[a.level] >= levelRank[AccountabilityAlertLevel.A1])) {
    status = AccountabilityStatus.VARIANCE_REVIEW_REQUIRED;
  }

  const quarterly = await getOrCreateCurrentQuarterlyReview(licencePlate);
  if (quarterly.status === QuarterlyReviewStatus.ESCALATED) {
    status = AccountabilityStatus.ESCALATED;
  } else if (quarterly.status === QuarterlyReviewStatus.PENDING && !quarterly.poSignedOff) {
    const now = new Date();
    if (now > getMPlusOneDate(quarterly.fiscalYear, quarterly.quarter)) {
      status = AccountabilityStatus.FORECAST_REVIEW_REQUIRED;
    }
  }

  return prisma.cloudCostAccountabilityState.upsert({
    where: { licencePlate },
    create: {
      licencePlate,
      status,
      highestOpenAlert,
      activeForecastId: activeForecast?.id,
      onEscalationList: quarterly.status === QuarterlyReviewStatus.ESCALATED,
      evaluatedAt: new Date(),
    },
    update: {
      status,
      highestOpenAlert,
      activeForecastId: activeForecast?.id,
      onEscalationList: quarterly.status === QuarterlyReviewStatus.ESCALATED,
      evaluatedAt: new Date(),
    },
  });
}

export async function getOrCreateCurrentQuarterlyReview(licencePlate: string) {
  const { fiscalYear, quarter } = getCurrentQuarter();
  return prisma.quarterlyForecastReview.upsert({
    where: { licencePlate_fiscalYear_quarter: { licencePlate, fiscalYear, quarter } },
    create: { licencePlate, fiscalYear, quarter },
    update: {},
  });
}

export async function getAccountabilitySummary(licencePlate: string) {
  const { year, month } = getCurrentBillingPeriod();

  const [
    state,
    snapshot,
    activeForecast,
    openAlerts,
    quarterlyReview,
    spendHistory,
    alertHistory,
    notificationLogs,
    escalations,
  ] = await Promise.all([
    prisma.cloudCostAccountabilityState.findUnique({ where: { licencePlate } }),
    prisma.cloudSpendSnapshot.findFirst({
      where: { licencePlate, periodYear: year, periodMonth: month },
      orderBy: { asOfDate: 'desc' },
    }),
    getActiveApprovedForecast(licencePlate),
    prisma.accountabilityAlert.findMany({
      where: {
        licencePlate,
        status: { in: [AccountabilityAlertStatus.OPEN, AccountabilityAlertStatus.ACKNOWLEDGED] },
      },
      orderBy: { triggeredAt: 'desc' },
    }),
    getOrCreateCurrentQuarterlyReview(licencePlate),
    prisma.cloudSpendHistory.findFirst({ where: { licencePlate } }),
    prisma.accountabilityAlert.findMany({
      where: { licencePlate },
      orderBy: { triggeredAt: 'desc' },
      take: 20,
    }),
    prisma.accountabilityNotificationLog.findMany({
      where: { licencePlate },
      orderBy: { sentAt: 'desc' },
      take: 20,
    }),
    prisma.quarterlyForecastReview.findMany({
      where: { licencePlate, escalatedAt: { not: null } },
      orderBy: { escalatedAt: 'desc' },
      take: 10,
    }),
  ]);

  const forecasts = await prisma.cloudCostForecast.findMany({
    where: { licencePlate },
    orderBy: { version: 'desc' },
    take: 10,
  });

  return {
    state,
    snapshot,
    activeForecast,
    forecasts,
    openAlerts,
    quarterlyReview,
    spendHistory,
    alertHistory,
    notificationLogs,
    escalations,
  };
}

export async function getCurrentMonthSpend(licencePlate: string) {
  const { year, month } = getCurrentBillingPeriod();
  const [snapshot, spendHistory] = await Promise.all([
    prisma.cloudSpendSnapshot.findFirst({
      where: { licencePlate, periodYear: year, periodMonth: month },
      orderBy: { asOfDate: 'desc' },
    }),
    prisma.cloudSpendHistory.findFirst({ where: { licencePlate } }),
  ]);

  return {
    billingPeriod: { year, month },
    snapshot,
    spendHistory,
  };
}

export type AccountabilityExportRow = {
  'Licence plate': string;
  'Product name': string;
  Provider: string;
  Month: string;
  'Forecast amount': number | string;
  'Actual amount': number | string;
  'Variance amount': number | string;
  'Variance %': number | string;
  Currency: string;
};

function monthSortKey(year: number, month: number) {
  return year * 100 + month;
}

export async function buildProjectAccountabilityExportRows(licencePlate: string): Promise<AccountabilityExportRow[]> {
  const product = await prisma.publicCloudProduct.findFirst({ where: { licencePlate } });
  if (!product) return [];

  const [forecast, history] = await Promise.all([
    getActiveApprovedForecast(licencePlate),
    prisma.cloudSpendHistory.findFirst({ where: { licencePlate } }),
  ]);

  const forecastByKey = new Map((forecast?.monthlyValues ?? []).map((v) => [`${v.year}-${v.month}`, v] as const));
  const historyByKey = new Map((history?.months ?? []).map((m) => [`${m.year}-${m.month}`, m] as const));
  const allKeys = [...new Set([...forecastByKey.keys(), ...historyByKey.keys()])].sort(
    (a, b) =>
      monthSortKey(Number(a.split('-')[0]), Number(a.split('-')[1])) -
      monthSortKey(Number(b.split('-')[0]), Number(b.split('-')[1])),
  );

  return allKeys.map((key) => {
    const [yearStr, monthStr] = key.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const forecastValue = forecastByKey.get(key);
    const historyValue = historyByKey.get(key);
    const currency = historyValue?.currency ?? forecastValue?.currency ?? 'USD';

    return {
      'Licence plate': licencePlate,
      'Product name': product.name,
      Provider: product.provider,
      Month: `${year}-${String(month).padStart(2, '0')}`,
      'Forecast amount': forecastValue?.amount ?? '',
      'Actual amount': historyValue?.actualTotal ?? '',
      'Variance amount': historyValue?.varianceAmount ?? '',
      'Variance %': historyValue?.variancePercent ?? '',
      Currency: currency,
    };
  });
}

export async function buildBundledAccountabilityExportRows(provider?: Provider): Promise<AccountabilityExportRow[]> {
  const products = await prisma.publicCloudProduct.findMany({
    where: {
      status: ProjectStatus.ACTIVE,
      ...(provider ? { provider } : {}),
    },
    select: { licencePlate: true },
    orderBy: { licencePlate: 'asc' },
  });

  const rows: AccountabilityExportRow[] = [];
  for (const product of products) {
    rows.push(...(await buildProjectAccountabilityExportRows(product.licencePlate)));
  }
  return rows;
}

/** Load a forecast, ensuring it belongs to the product the caller was authorized for. */
async function getForecastForProduct(licencePlate: string, forecastId: string) {
  const forecast = await prisma.cloudCostForecast.findUnique({ where: { id: forecastId } });
  if (!forecast || forecast.licencePlate !== licencePlate) {
    throw new Error('Forecast not found for this product');
  }
  return forecast;
}

export async function createForecastDraft(
  licencePlate: string,
  monthlyValues: { year: number; month: number; amount: number; currency: string }[],
  horizonMonths: number,
) {
  const openForecast = await prisma.cloudCostForecast.findFirst({
    where: {
      licencePlate,
      status: { in: [CloudCostForecastStatus.DRAFT, CloudCostForecastStatus.PENDING_APPROVAL] },
    },
  });
  if (openForecast) {
    throw new Error('A draft or pending forecast already exists for this product');
  }

  const latest = await prisma.cloudCostForecast.findFirst({
    where: { licencePlate },
    orderBy: { version: 'desc' },
  });

  const version = latest ? latest.version + 1 : 1;

  const product = await prisma.publicCloudProduct.findFirst({ where: { licencePlate } });
  const sourceBudgetSnapshot = product?.budget ?? undefined;

  return prisma.cloudCostForecast.create({
    data: {
      licencePlate,
      status: CloudCostForecastStatus.DRAFT,
      version,
      horizonMonths,
      monthlyValues,
      sourceBudgetSnapshot,
    },
  });
}

export async function updateForecastDraft(
  licencePlate: string,
  forecastId: string,
  monthlyValues: { year: number; month: number; amount: number; currency: string }[],
  horizonMonths: number,
  changeMeta?: { changeJustification?: string; changeNature?: string },
) {
  const forecast = await getForecastForProduct(licencePlate, forecastId);
  if (forecast.status !== CloudCostForecastStatus.DRAFT) {
    throw new Error('Only draft forecasts can be updated');
  }

  const existingValues =
    (forecast.monthlyValues as {
      year: number;
      month: number;
      amount: number;
      currency: string;
    }[]) ?? [];

  const sanitizedValues = preserveLockedPastMonthlyValues(existingValues, monthlyValues);

  return prisma.cloudCostForecast.update({
    where: { id: forecastId },
    data: {
      monthlyValues: sanitizedValues,
      horizonMonths,
      ...(changeMeta?.changeJustification
        ? {
            changeJustification: changeMeta.changeJustification,
            changeNature: changeMeta.changeNature ?? null,
          }
        : {}),
    },
  });
}

export async function submitForecast(licencePlate: string, forecastId: string, userId: string) {
  const forecast = await getForecastForProduct(licencePlate, forecastId);
  if (forecast.status !== CloudCostForecastStatus.DRAFT) {
    throw new Error('Only draft forecasts can be submitted');
  }

  return prisma.cloudCostForecast.update({
    where: { id: forecastId },
    data: {
      status: CloudCostForecastStatus.PENDING_APPROVAL,
      submittedAt: new Date(),
      submittedById: userId,
    },
  });
}

export async function approveForecast(licencePlate: string, forecastId: string, userId: string) {
  const forecast = await getForecastForProduct(licencePlate, forecastId);
  if (forecast.status !== CloudCostForecastStatus.PENDING_APPROVAL) {
    throw new Error('Only pending forecasts can be approved');
  }

  await prisma.cloudCostForecast.updateMany({
    where: {
      licencePlate: forecast.licencePlate,
      status: CloudCostForecastStatus.APPROVED,
    },
    data: { status: CloudCostForecastStatus.SUPERSEDED },
  });

  const approved = await prisma.cloudCostForecast.update({
    where: { id: forecastId },
    data: {
      status: CloudCostForecastStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: userId,
    },
  });

  await recomputeAccountabilityState(forecast.licencePlate);
  return approved;
}

export async function rejectForecast(
  licencePlate: string,
  forecastId: string,
  userId: string,
  rejectionReason: string,
) {
  const forecast = await getForecastForProduct(licencePlate, forecastId);
  if (forecast.status !== CloudCostForecastStatus.PENDING_APPROVAL) {
    throw new Error('Only pending forecasts can be rejected');
  }

  const rejected = await prisma.cloudCostForecast.update({
    where: { id: forecastId },
    data: {
      status: CloudCostForecastStatus.REJECTED,
      rejectedAt: new Date(),
      rejectedById: userId,
      rejectionReason,
    },
  });

  await recomputeAccountabilityState(forecast.licencePlate);
  return rejected;
}

const VARIANCE_ALERT_LEVELS: AccountabilityAlertLevel[] = [
  AccountabilityAlertLevel.A1,
  AccountabilityAlertLevel.A2,
  AccountabilityAlertLevel.A3,
];

/** Load an alert, ensuring it belongs to the product the caller was authorized for. */
async function getAlertForProduct(licencePlate: string, alertId: string) {
  const alert = await prisma.accountabilityAlert.findUnique({ where: { id: alertId } });
  if (!alert || alert.licencePlate !== licencePlate) {
    throw new Error('Alert not found for this product');
  }
  return alert;
}

export async function acknowledgeAlert(licencePlate: string, alertId: string, userId: string, explanation?: string) {
  const alert = await getAlertForProduct(licencePlate, alertId);
  if (VARIANCE_ALERT_LEVELS.includes(alert.level) && !explanation?.trim()) {
    throw new Error('Explanation is required for variance alerts');
  }

  return prisma.accountabilityAlert.update({
    where: { id: alert.id },
    data: {
      status: AccountabilityAlertStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
      acknowledgedById: userId,
      explanation: explanation?.trim() || undefined,
    },
  });
}

export async function resolveAlert(
  licencePlate: string,
  alertId: string,
  userId: string,
  resolutionReason: string,
  explanation?: string,
) {
  const existing = await getAlertForProduct(licencePlate, alertId);
  const alert = await prisma.accountabilityAlert.update({
    where: { id: existing.id },
    data: {
      status: AccountabilityAlertStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedById: userId,
      resolutionReason,
      explanation: explanation ?? undefined,
    },
  });

  await recomputeAccountabilityState(alert.licencePlate);
  return alert;
}

export async function updateQuarterlyReview(
  licencePlate: string,
  data: {
    forecastMonthsAdded?: boolean;
    forecastMonthsReviewed?: boolean;
    membersReviewed?: boolean;
    spendLookbackReviewed?: boolean;
    softQrCompleted?: boolean;
  },
) {
  const review = await getOrCreateCurrentQuarterlyReview(licencePlate);
  return prisma.quarterlyForecastReview.update({
    where: { id: review.id },
    data,
  });
}

export async function signOffQuarterlyReview(licencePlate: string, userId: string) {
  const review = await getOrCreateCurrentQuarterlyReview(licencePlate);
  const updated = await prisma.quarterlyForecastReview.update({
    where: { id: review.id },
    data: {
      poSignedOff: true,
      poSignedOffAt: new Date(),
      poSignedOffById: userId,
      status: QuarterlyReviewStatus.COMPLETE,
    },
  });
  await recomputeAccountabilityState(licencePlate);
  return updated;
}

export function seedForecastFromProductBudget(
  provider: Provider,
  budget: { dev: number; test: number; prod: number; tools: number },
  environmentsEnabled: {
    development: boolean;
    test: boolean;
    production: boolean;
    tools: boolean;
  },
) {
  const currency = provider === Provider.AZURE ? 'CAD' : 'USD';
  let total = 0;
  if (environmentsEnabled.development) total += budget.dev;
  if (environmentsEnabled.test) total += budget.test;
  if (environmentsEnabled.production) total += budget.prod;
  if (environmentsEnabled.tools) total += budget.tools;

  const now = new Date();
  return buildFiscalForecastMonths(FISCAL_FORECAST_YEARS, total, currency, now);
}

export type PublicCloudAccountabilitySearchRow = {
  id: string;
  licencePlate: string;
  name: string;
  provider: Provider;
  status: AccountabilityStatus;
  highestOpenAlert: AccountabilityAlertLevel | null;
  onEscalationList: boolean;
  variancePercent: number | null;
  quarterlyReviewStatus: QuarterlyReviewStatus | null;
  poSignedOff: boolean;
  evaluatedAt: Date | null;
};

export async function searchPublicCloudAccountability({
  search = '',
  page,
  pageSize,
  status,
  statuses,
  provider,
  highestOpenAlert,
  onEscalationList,
  sortKey = 'licencePlate',
  sortOrder = Prisma.SortOrder.asc,
  skip,
  take,
}: {
  search?: string;
  page?: number;
  pageSize?: number;
  status?: AccountabilityStatus;
  statuses?: AccountabilityStatus[];
  provider?: Provider;
  highestOpenAlert?: AccountabilityAlertLevel;
  onEscalationList?: boolean;
  sortKey?: string;
  sortOrder?: Prisma.SortOrder;
  skip?: number;
  take?: number;
}) {
  const _isNumber = (v: unknown) => typeof v === 'number';

  if (!_isNumber(skip) && !_isNumber(take) && page && pageSize) {
    ({ skip, take } = parsePaginationParams(page, pageSize, 10));
  }

  const productWhere: Prisma.PublicCloudProductWhereInput = {
    status: ProjectStatus.ACTIVE,
  };

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    productWhere.OR = [
      { licencePlate: { contains: trimmedSearch, mode: Prisma.QueryMode.insensitive } },
      { name: { contains: trimmedSearch, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  if (provider) {
    productWhere.provider = provider;
  }

  const products = await prisma.publicCloudProduct.findMany({
    where: productWhere,
    select: {
      id: true,
      licencePlate: true,
      name: true,
      provider: true,
    },
  });

  const licencePlates = products.map((p) => p.licencePlate);
  const { year: periodYear, month: periodMonth } = getCurrentBillingPeriod();
  const { fiscalYear, quarter } = getCurrentQuarter();

  const [states, snapshots, quarterlyReviews] = await Promise.all([
    prisma.cloudCostAccountabilityState.findMany({
      where: { licencePlate: { in: licencePlates } },
    }),
    prisma.cloudSpendSnapshot.findMany({
      where: { licencePlate: { in: licencePlates }, periodYear, periodMonth },
    }),
    prisma.quarterlyForecastReview.findMany({
      where: { licencePlate: { in: licencePlates }, fiscalYear, quarter },
    }),
  ]);

  const stateMap = new Map(states.map((s) => [s.licencePlate, s]));
  const snapshotMap = new Map(snapshots.map((s) => [s.licencePlate, s]));
  const quarterlyMap = new Map(quarterlyReviews.map((q) => [q.licencePlate, q]));

  let rows: PublicCloudAccountabilitySearchRow[] = products.map((product) => {
    const state = stateMap.get(product.licencePlate);
    const snapshot = snapshotMap.get(product.licencePlate);
    const quarterly = quarterlyMap.get(product.licencePlate);

    return {
      id: product.id,
      licencePlate: product.licencePlate,
      name: product.name,
      provider: product.provider,
      status: state?.status ?? AccountabilityStatus.FORECAST_REQUIRED,
      highestOpenAlert: state?.highestOpenAlert ?? null,
      onEscalationList: state?.onEscalationList ?? false,
      variancePercent: snapshot?.variancePercent ?? null,
      quarterlyReviewStatus: quarterly?.status ?? null,
      poSignedOff: quarterly?.poSignedOff ?? false,
      evaluatedAt: state?.evaluatedAt ?? null,
    };
  });

  // Portfolio KPIs are computed before status/alert/escalation filters so the
  // summary cards reflect the whole (search/provider-scoped) portfolio, not the
  // currently selected preset.
  const summary = {
    totalProjects: rows.length,
    needingAction: rows.filter((r) => r.status !== AccountabilityStatus.COMPLIANT).length,
    escalated: rows.filter((r) => r.onEscalationList).length,
    openAlerts: rows.filter((r) => r.highestOpenAlert).length,
  };

  if (status) {
    rows = rows.filter((r) => r.status === status);
  }
  if (statuses?.length) {
    rows = rows.filter((r) => statuses.includes(r.status));
  }
  if (highestOpenAlert) {
    rows = rows.filter((r) => r.highestOpenAlert === highestOpenAlert);
  }
  if (onEscalationList === true) {
    rows = rows.filter((r) => r.onEscalationList);
  }

  const sortField = sortKey === 'name' ? 'name' : sortKey === 'status' ? 'status' : 'licencePlate';
  rows.sort((a, b) => {
    const aVal = a[sortField as keyof PublicCloudAccountabilitySearchRow];
    const bVal = b[sortField as keyof PublicCloudAccountabilitySearchRow];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortOrder === Prisma.SortOrder.desc ? -cmp : cmp;
  });

  const totalCount = rows.length;
  const data = rows.slice(skip ?? 0, (skip ?? 0) + (take ?? rows.length));

  return { data, totalCount, summary };
}

export type PublicCloudAccountabilitySearchSummary = Awaited<
  ReturnType<typeof searchPublicCloudAccountability>
>['summary'];
