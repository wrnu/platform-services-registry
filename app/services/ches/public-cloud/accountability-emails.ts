import _compact from 'lodash-es/compact';
import { IS_PROD } from '@/config';
import { publicCloudTeamEmail, GlobalRole } from '@/constants';
import prisma from '@/core/prisma';
import type { ProductAlertProps } from '@/emails/_components/public-cloud/AlertSpendSummary';
import ConsumptionMilestoneTemplate from '@/emails/_templates/public-cloud/ConsumptionMilestone';
import ConsumptionPaceWarningTemplate from '@/emails/_templates/public-cloud/ConsumptionPaceWarning';
import CostAlertA1Template from '@/emails/_templates/public-cloud/CostAlertA1';
import CostAlertA1AdminTemplate from '@/emails/_templates/public-cloud/CostAlertA1Admin';
import CostAlertA2Template from '@/emails/_templates/public-cloud/CostAlertA2';
import CostAlertA2AdminTemplate from '@/emails/_templates/public-cloud/CostAlertA2Admin';
import CostAlertA3Template from '@/emails/_templates/public-cloud/CostAlertA3';
import CostAlertA3AdminTemplate from '@/emails/_templates/public-cloud/CostAlertA3Admin';
import ForecastRejectedTemplate from '@/emails/_templates/public-cloud/ForecastRejected';
import ForecastSubmittedTemplate from '@/emails/_templates/public-cloud/ForecastSubmitted';
import MonthlyAccountabilityRecapTemplate from '@/emails/_templates/public-cloud/MonthlyAccountabilityRecap';
import NonComplianceSummaryTemplate from '@/emails/_templates/public-cloud/NonComplianceSummary';
import QuarterlyEscalationTemplate from '@/emails/_templates/public-cloud/QuarterlyEscalation';
import QuarterlyForecastReminderTemplate from '@/emails/_templates/public-cloud/QuarterlyForecastReminder';
import QuarterlySignOffReminderTemplate from '@/emails/_templates/public-cloud/QuarterlySignOffReminder';
import { AccountabilityAlertLevel, AccountabilityStatus, ProjectStatus } from '@/prisma/client';
import { safeSendEmail, sendEmail } from '@/services/ches/core';
import { getContent } from '@/services/ches/helpers';
import { findUserEmailsByAuthRole } from '@/services/keycloak/app-realm';
import type { CspConsumptionAlert } from '@/validation-schemas/cloud-cost';

async function getProductTeamEmails(licencePlate: string) {
  const product = await prisma.publicCloudProduct.findFirst({
    where: { licencePlate },
    select: {
      name: true,
      projectOwner: { select: { email: true } },
      primaryTechnicalLead: { select: { email: true } },
      secondaryTechnicalLead: { select: { email: true } },
    },
  });

  if (!product) return { emails: [], name: licencePlate };

  return {
    name: product.name,
    emails: _compact([
      product.projectOwner.email,
      product.primaryTechnicalLead.email,
      product.secondaryTechnicalLead?.email,
    ]),
  };
}

async function getAdminAlertEmails(level: AccountabilityAlertLevel) {
  const adminEmails = await findUserEmailsByAuthRole(GlobalRole.Admin);
  const publicAdminEmails = await findUserEmailsByAuthRole(GlobalRole.PublicAdmin);

  if (level === AccountabilityAlertLevel.A1) {
    return _uniqEmails([...adminEmails, ...publicAdminEmails]);
  }

  const billingReviewerEmails = await findUserEmailsByAuthRole(GlobalRole.BillingReviewer);
  const emails = [...adminEmails, ...publicAdminEmails, ...billingReviewerEmails];

  if (level === AccountabilityAlertLevel.A3) {
    const billingManagerEmails = await findUserEmailsByAuthRole(GlobalRole.BillingManager);
    return _uniqEmails([...emails, ...billingManagerEmails]);
  }

  return _uniqEmails(emails);
}

function _uniqEmails(emails: string[]) {
  return [...new Set(emails.filter(Boolean))];
}

export function getMPlusOneDate(fiscalYear: number, quarter: number) {
  const quarterStartMonth = (quarter - 1) * 3 + 1;
  return new Date(fiscalYear, quarterStartMonth, 1);
}

export function getDaysUntilMPlusOne(fiscalYear: number, quarter: number, from = new Date()) {
  const mPlusOne = getMPlusOneDate(fiscalYear, quarter);
  return Math.ceil((mPlusOne.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

async function getDirectorEscalationEmails() {
  return _uniqEmails([
    ...(await findUserEmailsByAuthRole(GlobalRole.PublicAdmin)),
    ...(await findUserEmailsByAuthRole(GlobalRole.BillingManager)),
    ...(await findUserEmailsByAuthRole(GlobalRole.BillingReviewer)),
  ]);
}

export async function sendQuarterlyForecastReminderEmail(licencePlate: string, quarter: number, fiscalYear: number) {
  const { emails, name } = await getProductTeamEmails(licencePlate);
  if (!emails.length) return;

  const content = await getContent(
    QuarterlyForecastReminderTemplate({
      productName: name,
      licencePlate,
      quarter,
      fiscalYear,
    }),
  );

  return safeSendEmail({
    subject: `Quarterly forecast update — ${name} (${licencePlate})`,
    to: emails,
    body: content,
  });
}

export async function sendForecastSubmittedEmail(
  licencePlate: string,
  forecast: { version: number; horizonMonths: number },
) {
  const product = await prisma.publicCloudProduct.findFirst({
    where: { licencePlate },
    select: { name: true },
  });
  if (!product) return;

  const recipients = _uniqEmails([
    ...(await findUserEmailsByAuthRole(GlobalRole.BillingReviewer)),
    ...(await findUserEmailsByAuthRole(GlobalRole.BillingManager)),
  ]);
  if (!recipients.length) return;

  const content = await getContent(
    ForecastSubmittedTemplate({
      productName: product.name,
      licencePlate,
      version: forecast.version,
      horizonMonths: forecast.horizonMonths,
    }),
  );

  return safeSendEmail({
    subject: `Forecast submitted — ${product.name} (${licencePlate}) v${forecast.version}`,
    to: recipients,
    cc: [IS_PROD ? publicCloudTeamEmail : ''],
    body: content,
  });
}

export async function sendForecastRejectedEmail(
  licencePlate: string,
  forecast: { version: number; rejectionReason: string | null },
) {
  const { emails, name } = await getProductTeamEmails(licencePlate);
  if (!emails.length || !forecast.rejectionReason) return;

  const content = await getContent(
    ForecastRejectedTemplate({
      productName: name,
      licencePlate,
      version: forecast.version,
      rejectionReason: forecast.rejectionReason,
    }),
  );

  return safeSendEmail({
    subject: `Forecast rejected — ${name} (${licencePlate}) v${forecast.version}`,
    to: emails,
    body: content,
  });
}

export async function sendNonComplianceSummaryEmail() {
  const products = await prisma.publicCloudProduct.findMany({
    where: { status: ProjectStatus.ACTIVE },
    select: { licencePlate: true, name: true },
  });

  const states = await prisma.cloudCostAccountabilityState.findMany({
    where: { licencePlate: { in: products.map((p) => p.licencePlate) } },
  });
  const stateMap = new Map(states.map((s) => [s.licencePlate, s]));

  const rows = products
    .map((p) => {
      const state = stateMap.get(p.licencePlate);
      return {
        licencePlate: p.licencePlate,
        name: p.name,
        status: state?.status ?? AccountabilityStatus.FORECAST_REQUIRED,
        highestOpenAlert: state?.highestOpenAlert,
      };
    })
    .filter((row) => row.status !== AccountabilityStatus.COMPLIANT);

  const recipients = _uniqEmails([
    ...(await findUserEmailsByAuthRole(GlobalRole.PublicAdmin)),
    ...(await findUserEmailsByAuthRole(GlobalRole.Admin)),
  ]);
  if (!recipients.length) return;

  const periodLabel = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  const content = await getContent(NonComplianceSummaryTemplate({ rows, periodLabel }));

  return sendEmail({
    subject: `Public Cloud non-compliance summary — ${periodLabel}`,
    to: recipients,
    cc: [IS_PROD ? publicCloudTeamEmail : ''],
    body: content,
  });
}

export async function sendWeeklySignOffReminderEmail(licencePlate: string, quarter: number, fiscalYear: number) {
  const product = await prisma.publicCloudProduct.findFirst({
    where: { licencePlate },
    select: {
      name: true,
      projectOwner: { select: { email: true } },
    },
  });

  const poEmail = product?.projectOwner?.email;
  if (!product || !poEmail) return;

  const review = await prisma.quarterlyForecastReview.findFirst({
    where: { licencePlate, fiscalYear, quarter },
  });

  const daysUntilMPlusOne = getDaysUntilMPlusOne(fiscalYear, quarter);
  const content = await getContent(
    QuarterlySignOffReminderTemplate({
      productName: product.name,
      licencePlate,
      quarter,
      fiscalYear,
      daysUntilMPlusOne,
      checklist: {
        forecastMonthsAdded: review?.forecastMonthsAdded ?? false,
        forecastMonthsReviewed: review?.forecastMonthsReviewed ?? false,
        membersReviewed: review?.membersReviewed ?? false,
        spendLookbackReviewed: review?.spendLookbackReviewed ?? false,
        softQrCompleted: review?.softQrCompleted ?? false,
        poSignedOff: review?.poSignedOff ?? false,
      },
    }),
  );

  return safeSendEmail({
    subject: `Quarterly sign-off reminder — ${product.name} (${licencePlate})`,
    to: [poEmail],
    body: content,
  });
}

export async function sendQuarterlyEscalationEmail(licencePlate: string, quarter: number, fiscalYear: number) {
  const { emails: teamEmails, name } = await getProductTeamEmails(licencePlate);
  const directorEmails = await getDirectorEscalationEmails();
  if (!directorEmails.length) return;

  const content = await getContent(
    QuarterlyEscalationTemplate({
      productName: name,
      licencePlate,
      quarter,
      fiscalYear,
    }),
  );

  return sendEmail({
    subject: `[Escalation] Q${quarter} accountability incomplete — ${name} (${licencePlate})`,
    to: directorEmails,
    cc: _compact([...teamEmails, IS_PROD ? publicCloudTeamEmail : '']),
    body: content,
  });
}

function toProductAlertProps(productName: string, licencePlate: string, alert: CspConsumptionAlert): ProductAlertProps {
  return {
    productName,
    licencePlate,
    spendToDate: alert.spendToDate,
    forecastAmount: alert.currentMonthForecast,
    projectedMonthEnd: alert.projectedMonthEnd,
    varianceAmount: alert.varianceAmount,
    variancePercent: alert.variancePercent,
    consumptionPercentOfForecast: alert.consumptionPercentOfForecast,
    currency: alert.currency,
  };
}

async function buildTeamAlertContent(productName: string, alert: CspConsumptionAlert) {
  const props = toProductAlertProps(productName, alert.licencePlate, alert);

  switch (alert.alertType) {
    case 'MILESTONE':
      return getContent(
        ConsumptionMilestoneTemplate({
          ...props,
          milestonePercent: alert.milestonePercent ?? 0,
        }),
      );
    case 'PACE':
      return getContent(
        ConsumptionPaceWarningTemplate({
          ...props,
          paceDayOfMonth: alert.paceDayOfMonth,
        }),
      );
    case 'A1':
      return getContent(CostAlertA1Template(props));
    case 'A2':
      return getContent(CostAlertA2Template(props));
    case 'A3':
      return getContent(CostAlertA3Template(props));
    default:
      throw new Error(`Unsupported alert type: ${alert.alertType}`);
  }
}

async function buildAdminAlertContent(
  productName: string,
  alert: CspConsumptionAlert,
  level: AccountabilityAlertLevel,
) {
  const props = toProductAlertProps(productName, alert.licencePlate, alert);

  switch (level) {
    case AccountabilityAlertLevel.A1:
      return getContent(CostAlertA1AdminTemplate(props));
    case AccountabilityAlertLevel.A2:
      return getContent(CostAlertA2AdminTemplate(props));
    case AccountabilityAlertLevel.A3:
      return getContent(CostAlertA3AdminTemplate(props));
    default:
      throw new Error(`No admin template for alert level: ${level}`);
  }
}

function teamAlertSubject(productName: string, alert: CspConsumptionAlert) {
  switch (alert.alertType) {
    case 'MILESTONE':
      return `Consumption milestone (${alert.milestonePercent ?? 0}%) — ${productName}`;
    case 'PACE':
      return `Early pace warning — ${productName}`;
    case 'A1':
      return `A1 variance alert — review forecast — ${productName}`;
    case 'A2':
      return `A2 variance alert — significant overrun — ${productName}`;
    case 'A3':
      return `A3 variance alert — critical overrun — ${productName}`;
    default:
      return `${alert.alertType} cloud spend alert — ${productName}`;
  }
}

export async function sendConsumptionAlertEmails(alert: CspConsumptionAlert) {
  const { emails, name } = await getProductTeamEmails(alert.licencePlate);
  const teamContent = await buildTeamAlertContent(name, alert);

  if (emails.length) {
    await safeSendEmail({
      subject: teamAlertSubject(name, alert),
      to: emails,
      body: teamContent,
    });
  }

  const varianceLevels: AccountabilityAlertLevel[] = [
    AccountabilityAlertLevel.A1,
    AccountabilityAlertLevel.A2,
    AccountabilityAlertLevel.A3,
  ];

  if (varianceLevels.includes(alert.alertType as AccountabilityAlertLevel)) {
    const level = alert.alertType as AccountabilityAlertLevel;
    const adminEmails = await getAdminAlertEmails(level);
    if (adminEmails.length) {
      const adminContent = await buildAdminAlertContent(name, alert, level);
      await safeSendEmail({
        subject: `[Admin] ${level} variance alert — ${name} (${alert.licencePlate})`,
        to: adminEmails,
        cc: [IS_PROD ? publicCloudTeamEmail : ''],
        body: adminContent,
      });
    }
  }
}

export async function sendMonthlyAccountabilityRecapEmail() {
  const products = await prisma.publicCloudProduct.findMany({
    where: { status: ProjectStatus.ACTIVE },
    select: { licencePlate: true, name: true },
  });

  const states = await prisma.cloudCostAccountabilityState.findMany({
    where: { licencePlate: { in: products.map((p) => p.licencePlate) } },
  });
  const stateMap = new Map(states.map((s) => [s.licencePlate, s]));

  const rows = products.map((p) => {
    const state = stateMap.get(p.licencePlate);
    return {
      licencePlate: p.licencePlate,
      name: p.name,
      status: state?.status ?? 'FORECAST_REQUIRED',
      highestOpenAlert: state?.highestOpenAlert,
      onEscalationList: state?.onEscalationList ?? false,
    };
  });

  const now = new Date();
  const periodLabel = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  const content = await getContent(MonthlyAccountabilityRecapTemplate({ rows, periodLabel }));

  const recipients = _uniqEmails([
    ...(await findUserEmailsByAuthRole(GlobalRole.PublicAdmin)),
    ...(await findUserEmailsByAuthRole(GlobalRole.BillingReviewer)),
    ...(await findUserEmailsByAuthRole(GlobalRole.BillingManager)),
  ]);

  if (!recipients.length) return;

  return sendEmail({
    subject: `Public Cloud monthly accountability recap — ${periodLabel}`,
    to: recipients,
    cc: [IS_PROD ? publicCloudTeamEmail : ''],
    body: content,
  });
}
