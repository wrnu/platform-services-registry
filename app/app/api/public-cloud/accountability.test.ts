import { expect } from '@jest/globals';
import { FISCAL_FORECAST_HORIZON_MONTHS } from '@/components/public-cloud/accountability/forecast-grid-utils';
import { GlobalRole } from '@/constants';
import prisma from '@/core/prisma';
import { AccountabilityAlertStatus, CloudCostForecastStatus, Provider } from '@/prisma/client';
import { mockSessionByIdirGuid, mockSessionByRole, mockTeamServiceAccount } from '@/services/api-test/core';
import {
  acknowledgePublicCloudAlert,
  approvePublicCloudForecast,
  buildCspAlertPayload,
  buildCspHistoryPayload,
  buildCspSnapshotPayload,
  buildForecastMonthlyValues,
  createPublicCloudForecast,
  getPublicCloudAccountability,
  getPublicCloudCosts,
  getPublicCloudQuarterlyReview,
  listPublicCloudForecasts,
  postAccountabilityJob,
  postCspAlert,
  putCspConsumption,
  putCspConsumptionHistory,
  rejectPublicCloudForecast,
  resolvePublicCloudAlert,
  signOffPublicCloudQuarterlyReview,
  submitPublicCloudForecast,
  updatePublicCloudForecast,
  updatePublicCloudQuarterlyReview,
} from '@/services/api-test/public-cloud/accountability';
import { createPublicCloudProduct } from '@/services/api-test/public-cloud/helpers';
import { safeSendEmail } from '@/services/ches/core';
import { seedDefaultCloudCostRulesConfig } from '@/services/db/cloud-cost-rules';

async function cleanUpAccountabilityData() {
  await prisma.accountabilityNotificationLog.deleteMany();
  await prisma.accountabilityAlert.deleteMany();
  await prisma.cloudSpendSnapshot.deleteMany();
  await prisma.cloudSpendHistory.deleteMany();
  await prisma.cloudCostForecast.deleteMany();
  await prisma.quarterlyForecastReview.deleteMany();
  await prisma.cloudCostAccountabilityState.deleteMany();
  await prisma.cloudCostRulesConfig.deleteMany();
}

describe('Public Cloud accountability APIs', () => {
  let licencePlate: string;
  let projectOwnerIdirGuid: string;
  let provider: Provider;
  let currency: string;

  beforeAll(async () => {
    await cleanUpAccountabilityData();
    await seedDefaultCloudCostRulesConfig();

    const decisionData = await createPublicCloudProduct();
    expect(decisionData).not.toBeNull();
    if (!decisionData) throw new Error('failed to provision test product');

    licencePlate = decisionData.licencePlate;
    projectOwnerIdirGuid = decisionData.projectOwner.idirGuid;

    const product = await prisma.publicCloudProduct.findFirst({ where: { licencePlate } });
    expect(product).toBeTruthy();
    provider = product!.provider;
    currency = provider === Provider.AZURE ? 'CAD' : 'USD';
  });

  describe('CSP ingest (service account)', () => {
    beforeEach(async () => {
      await mockTeamServiceAccount(['service-account']);
    });

    it('upserts consumption snapshot', async () => {
      const response = await putCspConsumption(buildCspSnapshotPayload(licencePlate, provider, currency));
      expect(response.status).toBe(200);

      const snapshot = await response.json();
      expect(snapshot.licencePlate).toBe(licencePlate);
      expect(snapshot.amountToDate).toBe(3200);
    });

    it('sends pre-emptive notice (A0) when threshold met', async () => {
      const payload = {
        ...buildCspSnapshotPayload(licencePlate, provider, currency),
        spendToDate: 1600,
        currentMonthForecast: 5000,
        consumptionPercentOfForecast: 32,
        varianceAmount: -3400,
        variancePercent: -68,
        dayOfMonth: 4,
      };

      const response = await putCspConsumption(payload);
      expect(response.status).toBe(200);

      const log = await prisma.accountabilityNotificationLog.findFirst({
        where: { licencePlate, templateKey: 'PREEMPTIVE_THRESHOLD' },
      });
      expect(log).toBeTruthy();
      expect(log?.status).toBe('sent');
      expect(safeSendEmail).toHaveBeenCalled();
    });

    it('does not duplicate pre-emptive notice in the same billing period', async () => {
      const payload = {
        ...buildCspSnapshotPayload(licencePlate, provider, currency),
        spendToDate: 1700,
        currentMonthForecast: 5000,
        consumptionPercentOfForecast: 34,
        dayOfMonth: 4,
      };

      await putCspConsumption(payload);

      const count = await prisma.accountabilityNotificationLog.count({
        where: { licencePlate, templateKey: 'PREEMPTIVE_THRESHOLD' },
      });
      expect(count).toBe(1);
    });

    it('records consumption alert and sends team email', async () => {
      const response = await postCspAlert(buildCspAlertPayload(licencePlate, provider, 'MILESTONE', currency));
      expect(response.status).toBe(200);

      const alert = await response.json();
      expect(alert.level).toBe('MILESTONE');
      expect(alert.milestonePercent).toBe(80);

      expect(safeSendEmail).toHaveBeenCalled();

      const log = await prisma.accountabilityNotificationLog.findFirst({
        where: { licencePlate, templateKey: 'CONSUMPTION_MILESTONE' },
      });
      expect(log).toBeTruthy();
    });

    it('upserts consumption history', async () => {
      const response = await putCspConsumptionHistory(buildCspHistoryPayload(licencePlate, provider, currency));
      expect(response.status).toBe(200);

      const history = await response.json();
      expect(history.licencePlate).toBe(licencePlate);
      expect(history.months.length).toBeGreaterThan(0);
    });

    it('rejects CSP ingest without service account', async () => {
      await mockSessionByRole(GlobalRole.User);
      const response = await putCspConsumption(buildCspSnapshotPayload(licencePlate, provider, currency));
      expect(response.status).toBe(401);
    });
  });

  describe('Product costs and accountability (user)', () => {
    beforeEach(async () => {
      await mockSessionByIdirGuid(projectOwnerIdirGuid);
    });

    it('returns current month costs', async () => {
      const response = await getPublicCloudCosts(licencePlate);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.billingPeriod).toBeDefined();
      expect(data.snapshot?.licencePlate).toBe(licencePlate);
    });

    it('returns accountability summary with CSP data', async () => {
      const response = await getPublicCloudAccountability(licencePlate);
      expect(response.status).toBe(200);

      const summary = await response.json();
      expect(summary.snapshot).toBeTruthy();
      expect(summary.openAlerts?.length).toBeGreaterThan(0);
      expect(summary.quarterlyReview).toBeTruthy();
      expect(Array.isArray(summary.alertHistory)).toBe(true);
      expect(Array.isArray(summary.notificationLogs)).toBe(true);
      expect(Array.isArray(summary.forecasts)).toBe(true);
    });

    it('creates, submits, and approves a forecast', async () => {
      const createRes = await createPublicCloudForecast(licencePlate, {
        monthlyValues: buildForecastMonthlyValues(5000, currency, FISCAL_FORECAST_HORIZON_MONTHS),
        horizonMonths: FISCAL_FORECAST_HORIZON_MONTHS,
      });
      expect(createRes.status).toBe(200);

      const draft = await createRes.json();
      expect(draft.status).toBe(CloudCostForecastStatus.DRAFT);

      const updatedValues = buildForecastMonthlyValues(6000, currency, FISCAL_FORECAST_HORIZON_MONTHS);
      const updateRes = await updatePublicCloudForecast(licencePlate, draft.id, {
        monthlyValues: updatedValues,
        horizonMonths: FISCAL_FORECAST_HORIZON_MONTHS,
      });
      expect(updateRes.status).toBe(200);
      const updated = await updateRes.json();
      expect(updated.monthlyValues[0].amount).toBe(6000);

      const submitRes = await submitPublicCloudForecast(licencePlate, draft.id);
      expect(submitRes.status).toBe(200);

      await mockSessionByRole(GlobalRole.BillingReviewer);
      const approveRes = await approvePublicCloudForecast(licencePlate, draft.id);
      expect(approveRes.status).toBe(200);

      const approved = await approveRes.json();
      expect(approved.status).toBe(CloudCostForecastStatus.APPROVED);

      await mockSessionByIdirGuid(projectOwnerIdirGuid);
      const listRes = await listPublicCloudForecasts(licencePlate);
      expect(listRes.status).toBe(200);
      const list = await listRes.json();
      expect(list.activeForecast?.id).toBe(draft.id);
    });

    it('rejects a pending forecast with reason', async () => {
      const createRes = await createPublicCloudForecast(licencePlate, {
        monthlyValues: buildForecastMonthlyValues(4500, currency, FISCAL_FORECAST_HORIZON_MONTHS),
        horizonMonths: FISCAL_FORECAST_HORIZON_MONTHS,
      });
      expect(createRes.status).toBe(200);
      const draft = await createRes.json();

      const submitRes = await submitPublicCloudForecast(licencePlate, draft.id);
      expect(submitRes.status).toBe(200);

      await mockSessionByRole(GlobalRole.BillingReviewer);
      const rejectRes = await rejectPublicCloudForecast(licencePlate, draft.id, {
        rejectionReason: 'Forecast totals need ministry alignment',
      });
      expect(rejectRes.status).toBe(200);

      const rejected = await rejectRes.json();
      expect(rejected.status).toBe(CloudCostForecastStatus.REJECTED);
      expect(rejected.rejectionReason).toBe('Forecast totals need ministry alignment');
    });

    it('updates quarterly review and records PO sign-off', async () => {
      const updateRes = await updatePublicCloudQuarterlyReview(licencePlate, {
        forecastMonthsAdded: true,
        forecastMonthsReviewed: true,
        membersReviewed: true,
        spendLookbackReviewed: true,
        softQrCompleted: true,
      });
      expect(updateRes.status).toBe(200);

      const signOffRes = await signOffPublicCloudQuarterlyReview(licencePlate);
      expect(signOffRes.status).toBe(200);

      const review = await signOffRes.json();
      expect(review.poSignedOff).toBe(true);
    });

    it('acknowledges and resolves an open alert', async () => {
      const openAlert = await prisma.accountabilityAlert.findFirst({
        where: { licencePlate, status: AccountabilityAlertStatus.OPEN },
      });
      expect(openAlert).toBeTruthy();
      if (!openAlert) return;

      const ackRes = await acknowledgePublicCloudAlert(licencePlate, openAlert.id, {
        explanation: 'Reviewed in test',
      });
      expect(ackRes.status).toBe(200);

      const resolveRes = await resolvePublicCloudAlert(licencePlate, openAlert.id, {
        resolutionReason: 'Test resolution',
      });
      expect(resolveRes.status).toBe(200);

      const resolved = await resolveRes.json();
      expect(resolved.status).toBe(AccountabilityAlertStatus.RESOLVED);
    });

    it('returns quarterly review', async () => {
      const response = await getPublicCloudQuarterlyReview(licencePlate);
      expect(response.status).toBe(200);
      const review = await response.json();
      expect(review.licencePlate).toBe(licencePlate);
    });
  });

  describe('Internal accountability jobs (service account)', () => {
    beforeEach(async () => {
      await mockTeamServiceAccount(['service-account']);
    });

    it('runs monthly recap job', async () => {
      const response = await postAccountabilityJob('monthly-recap');
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result).toHaveProperty('sent');
    });

    it('rejects invalid job name', async () => {
      const { POST } = await import('@/app/api/internal/accountability/jobs/route');
      const { createRoute } = await import('@/services/api-test/core');
      const { getServiceAccountAuthHeader } = await import('@/helpers/mock-resources');
      const route = createRoute('/internal');
      const response = await route.post(
        POST,
        '/accountability/jobs',
        { job: 'not-a-real-job' },
        undefined,
        getServiceAccountAuthHeader(),
      );
      expect(response.status).toBe(400);
    });
  });
});
