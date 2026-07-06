import { POST as _postAccountabilityJob } from '@/app/api/internal/accountability/jobs/route';
import { POST as _postCspAlert } from '@/app/api/internal/csp/alerts/route';
import { PUT as _putCspConsumptionHistory } from '@/app/api/internal/csp/consumption/history/route';
import { PUT as _putCspConsumption } from '@/app/api/internal/csp/consumption/route';
import { GET as _getAccountability } from '@/app/api/public-cloud/products/[licencePlate]/accountability/route';
import { POST as _acknowledgeAlert } from '@/app/api/public-cloud/products/[licencePlate]/alerts/[alertId]/acknowledge/route';
import { POST as _resolveAlert } from '@/app/api/public-cloud/products/[licencePlate]/alerts/[alertId]/resolve/route';
import { GET as _getCosts } from '@/app/api/public-cloud/products/[licencePlate]/costs/route';
import { POST as _approveForecast } from '@/app/api/public-cloud/products/[licencePlate]/forecasts/[forecastId]/approve/route';
import { PUT as _updateForecast } from '@/app/api/public-cloud/products/[licencePlate]/forecasts/[forecastId]/route';
import { POST as _submitForecast } from '@/app/api/public-cloud/products/[licencePlate]/forecasts/[forecastId]/submit/route';
import {
  GET as _listForecasts,
  POST as _createForecast,
} from '@/app/api/public-cloud/products/[licencePlate]/forecasts/route';
import {
  GET as _getQuarterlyReview,
  POST as _signOffQuarterlyReview,
  PUT as _updateQuarterlyReview,
} from '@/app/api/public-cloud/products/[licencePlate]/quarterly-review/route';
import {
  buildFiscalForecastMonths,
  FISCAL_FORECAST_HORIZON_MONTHS,
} from '@/components/public-cloud/accountability/forecast-grid-utils';
import { getServiceAccountAuthHeader } from '@/helpers/mock-resources';
import { createRoute } from '../core';

const productRoute = createRoute('/public-cloud/products');
const internalRoute = createRoute('/internal');

function serviceAccountHeaders() {
  return getServiceAccountAuthHeader();
}

export async function putCspConsumption(data: Record<string, unknown>) {
  return internalRoute.put(_putCspConsumption, '/csp/consumption', data, undefined, serviceAccountHeaders());
}

export async function postCspAlert(data: Record<string, unknown>) {
  return internalRoute.post(_postCspAlert, '/csp/alerts', data, undefined, serviceAccountHeaders());
}

export async function putCspConsumptionHistory(data: Record<string, unknown>) {
  return internalRoute.put(
    _putCspConsumptionHistory,
    '/csp/consumption/history',
    data,
    undefined,
    serviceAccountHeaders(),
  );
}

export async function postAccountabilityJob(job: string) {
  return internalRoute.post(
    _postAccountabilityJob,
    '/accountability/jobs',
    { job },
    undefined,
    serviceAccountHeaders(),
  );
}

export async function getPublicCloudAccountability(licencePlate: string) {
  return productRoute.get(_getAccountability, '/{{licencePlate}}/accountability', {
    pathParams: { licencePlate },
  });
}

export async function getPublicCloudCosts(licencePlate: string) {
  return productRoute.get(_getCosts, '/{{licencePlate}}/costs', {
    pathParams: { licencePlate },
  });
}

export async function listPublicCloudForecasts(licencePlate: string) {
  return productRoute.get(_listForecasts, '/{{licencePlate}}/forecasts', {
    pathParams: { licencePlate },
  });
}

export async function createPublicCloudForecast(licencePlate: string, data?: Record<string, unknown>) {
  return productRoute.post(_createForecast, '/{{licencePlate}}/forecasts', data ?? {}, {
    pathParams: { licencePlate },
  });
}

export async function updatePublicCloudForecast(
  licencePlate: string,
  forecastId: string,
  data: Record<string, unknown>,
) {
  return productRoute.put(_updateForecast, '/{{licencePlate}}/forecasts/{{forecastId}}', data, {
    pathParams: { licencePlate, forecastId },
  });
}

export async function submitPublicCloudForecast(licencePlate: string, forecastId: string) {
  return productRoute.post(
    _submitForecast,
    '/{{licencePlate}}/forecasts/{{forecastId}}/submit',
    {},
    {
      pathParams: { licencePlate, forecastId },
    },
  );
}

export async function approvePublicCloudForecast(licencePlate: string, forecastId: string) {
  return productRoute.post(
    _approveForecast,
    '/{{licencePlate}}/forecasts/{{forecastId}}/approve',
    {},
    {
      pathParams: { licencePlate, forecastId },
    },
  );
}

export async function getPublicCloudQuarterlyReview(licencePlate: string) {
  return productRoute.get(_getQuarterlyReview, '/{{licencePlate}}/quarterly-review', {
    pathParams: { licencePlate },
  });
}

export async function updatePublicCloudQuarterlyReview(licencePlate: string, data: Record<string, boolean>) {
  return productRoute.put(_updateQuarterlyReview, '/{{licencePlate}}/quarterly-review', data, {
    pathParams: { licencePlate },
  });
}

export async function signOffPublicCloudQuarterlyReview(licencePlate: string) {
  return productRoute.post(
    _signOffQuarterlyReview,
    '/{{licencePlate}}/quarterly-review',
    {},
    {
      pathParams: { licencePlate },
    },
  );
}

export async function acknowledgePublicCloudAlert(
  licencePlate: string,
  alertId: string,
  data?: { explanation?: string },
) {
  return productRoute.post(_acknowledgeAlert, '/{{licencePlate}}/alerts/{{alertId}}/acknowledge', data ?? {}, {
    pathParams: { licencePlate, alertId },
  });
}

export async function resolvePublicCloudAlert(
  licencePlate: string,
  alertId: string,
  data: { resolutionReason: string; explanation?: string },
) {
  return productRoute.post(_resolveAlert, '/{{licencePlate}}/alerts/{{alertId}}/resolve', data, {
    pathParams: { licencePlate, alertId },
  });
}

export function buildForecastMonthlyValues(amount = 5000, currency = 'USD', months = FISCAL_FORECAST_HORIZON_MONTHS) {
  const fiscalYears = Math.ceil(months / 12);
  return buildFiscalForecastMonths(fiscalYears, amount, currency);
}

export function buildCspSnapshotPayload(licencePlate: string, provider: string, currency = 'USD') {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    licencePlate,
    provider,
    currency,
    billingPeriod: { year, month },
    asOf: now.toISOString(),
    spendToDate: 3200,
    projectedMonthEnd: 5500,
    currentMonthForecast: 5000,
    varianceAmount: 500,
    variancePercent: 10,
    consumptionPercentOfForecast: 64,
    dayOfMonth: now.getDate(),
    daysInMonth: new Date(year, month, 0).getDate(),
    accounts: [{ accountId: `${licencePlate}-dev`, environment: 'dev', spendToDate: 1100, currency }],
  };
}

export function buildCspAlertPayload(licencePlate: string, provider: string, alertType: string, currency = 'USD') {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    licencePlate,
    provider,
    currency,
    billingPeriod: { year, month },
    triggeredAt: now.toISOString(),
    alertType,
    milestonePercent: alertType === 'MILESTONE' ? 80 : undefined,
    spendToDate: 4000,
    projectedMonthEnd: 5500,
    currentMonthForecast: 5000,
    varianceAmount: 500,
    variancePercent: 10,
    consumptionPercentOfForecast: 80,
    ruleKey: 'api-test',
  };
}

export function buildCspHistoryPayload(licencePlate: string, provider: string, currency = 'USD') {
  const now = new Date();
  const month = now.getMonth();
  return {
    licencePlate,
    provider,
    months: [
      {
        billingPeriod: { year: now.getFullYear(), month: month === 0 ? 12 : month },
        currency,
        actualTotal: 4800,
        forecastTotal: 5000,
        varianceAmount: -200,
        variancePercent: -4,
      },
    ],
  };
}
