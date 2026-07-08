import _compact from 'lodash-es/compact';
import { IS_PROD } from '@/config';
import { publicCloudTeamEmail, GlobalRole } from '@/constants';
import { evaluatePreemptiveNotice } from '@/constants/cloud-cost-rules';
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
import EscalationListSummaryTemplate from '@/emails/_templates/public-cloud/EscalationListSummary';
import ForecastRejectedTemplate from '@/emails/_templates/public-cloud/ForecastRejected';
import ForecastSubmittedTemplate from '@/emails/_templates/public-cloud/ForecastSubmitted';
import MonthlyAccountabilityRecapTemplate from '@/emails/_templates/public-cloud/MonthlyAccountabilityRecap';
import NonComplianceSummaryTemplate from '@/emails/_templates/public-cloud/NonComplianceSummary';
import PreemptiveThresholdNoticeTemplate from '@/emails/_templates/public-cloud/PreemptiveThresholdNotice';
import QuarterlyEscalationTemplate from '@/emails/_templates/public-cloud/QuarterlyEscalation';
import QuarterlyForecastReminderTemplate from '@/emails/_templates/public-cloud/QuarterlyForecastReminder';
import QuarterlySignOffReminderTemplate from '@/emails/_templates/public-cloud/QuarterlySignOffReminder';
import { getDaysUntilMPlusOne } from '@/helpers/accountability-periods';
import {
  AccountabilityAlertLevel,
  AccountabilityStatus,
  CloudCostNotificationRouting,
  ProjectStatus,
  type CloudSpendSnapshot,
} from '@/prisma/client';
import { safeSendEmail, sendEmail } from '@/services/ches/core';
import { getContent } from '@/services/ches/helpers';
import {
  billingPeriodScenario,
  hasAccountabilityNotificationForScenario,
  recordAccountabilityNotification,
} from '@/services/db/accountability-notifications';
import { getActiveCloudCostRulesConfig } from '@/services/db/cloud-cost-rules';
import { findUserEmailsByAuthRole } from '@/services/keycloak/app-realm';
import type { CspConsumptionAlert } from '@/validation-schemas/cloud-cost';

type AccountabilityEmailPayload = {
  subject: string;
  to: string[];
  cc?: string[];
  body: string;
};

type AccountabilityEmailOptions = {
  licencePlate?: string;
  templateKey: string;
  scenario?: string;
  metadata?: Record<string, unknown>;
  useSafeSend?: boolean;
};

async function sendAccountabilityEmail(email: AccountabilityEmailPayload, options: AccountabilityEmailOptions) {
  const { licencePlate, templateKey, scenario, metadata, useSafeSend = true } = options;
  const to = email.to.filter(Boolean);
  const cc = email.cc?.filter(Boolean) ?? [];

  if (!to.length) {
    await recordAccountabilityNotification({
      licencePlate,
      templateKey,
      scenario,
      subject: email.subject,
      recipients: [],
      cc,
      status: 'skipped_no_recipients',
      metadata,
    });
    return;
  }

  const sendFn = useSafeSend ? safeSendEmail : sendEmail;
  const result = await sendFn({ ...email, to, cc });

  await recordAccountabilityNotification({
    licencePlate,
    templateKey,
    scenario,
    subject: email.subject,
    recipients: to,
    cc,
    status: result ? 'sent' : 'failed',
    metadata,
  });

  return result;
}

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

function _uniqEmails(emails: string[]) {
  return [...new Set(emails.filter(Boolean))];
}

type RoutingField = keyof CloudCostNotificationRouting;

async function resolveRoutingEmails(field: RoutingField, fallback: () => Promise<string[]>) {
  const rules = await getActiveCloudCostRulesConfig();
  const configured = rules.notificationRouting?.[field]?.filter(Boolean) ?? [];
  if (configured.length) return _uniqEmails(configured);
  return fallback();
}

async function getDefaultA1AdminEmails() {
  return _uniqEmails([
    ...(await findUserEmailsByAuthRole(GlobalRole.Admin)),
    ...(await findUserEmailsByAuthRole(GlobalRole.PublicAdmin)),
  ]);
}

async function getDefaultA2AdminEmails() {
  return _uniqEmails([
    ...(await getDefaultA1AdminEmails()),
    ...(await findUserEmailsByAuthRole(GlobalRole.BillingReviewer)),
  ]);
}

async function getDefaultA3AdminEmails() {
  return _uniqEmails([
    ...(await getDefaultA2AdminEmails()),
    ...(await findUserEmailsByAuthRole(GlobalRole.BillingManager)),
  ]);
}

async function getAdminAlertEmails(level: AccountabilityAlertLevel) {
  switch (level) {
    case AccountabilityAlertLevel.A1:
      return resolveRoutingEmails('a1AdminEmails', getDefaultA1AdminEmails);
    case AccountabilityAlertLevel.A2:
      return resolveRoutingEmails('a2AdminEmails', getDefaultA2AdminEmails);
    case AccountabilityAlertLevel.A3:
      return resolveRoutingEmails('a3AdminEmails', getDefaultA3AdminEmails);
    default:
      throw new Error(`No admin template for alert level: ${level}`);
  }
}

async function getDirectorEscalationEmails() {
  return resolveRoutingEmails('escalationEmails', async () =>
    _uniqEmails([
      ...(await findUserEmailsByAuthRole(GlobalRole.PublicAdmin)),
      ...(await findUserEmailsByAuthRole(GlobalRole.BillingManager)),
      ...(await findUserEmailsByAuthRole(GlobalRole.BillingReviewer)),
    ]),
  );
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

  return sendAccountabilityEmail(
    {
      subject: `Quarterly forecast update — ${name} (${licencePlate})`,
      to: emails,
      body: content,
    },
    {
      licencePlate,
      templateKey: 'QUARTERLY_FORECAST_REMINDER',
      scenario: `Q${quarter}-FY${fiscalYear}`,
      metadata: { quarter, fiscalYear },
    },
  );
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

  return sendAccountabilityEmail(
    {
      subject: `Forecast submitted — ${product.name} (${licencePlate}) v${forecast.version}`,
      to: recipients,
      cc: [IS_PROD ? publicCloudTeamEmail : ''],
      body: content,
    },
    {
      licencePlate,
      templateKey: 'FORECAST_SUBMITTED',
      scenario: `v${forecast.version}`,
      metadata: { version: forecast.version, horizonMonths: forecast.horizonMonths },
    },
  );
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

  return sendAccountabilityEmail(
    {
      subject: `Forecast rejected — ${name} (${licencePlate}) v${forecast.version}`,
      to: emails,
      body: content,
    },
    {
      licencePlate,
      templateKey: 'FORECAST_REJECTED',
      scenario: `v${forecast.version}`,
      metadata: { version: forecast.version },
    },
  );
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

  const recipients = await resolveRoutingEmails('nonComplianceEmails', async () =>
    _uniqEmails([
      ...(await findUserEmailsByAuthRole(GlobalRole.PublicAdmin)),
      ...(await findUserEmailsByAuthRole(GlobalRole.Admin)),
    ]),
  );
  if (!recipients.length) return;

  const periodLabel = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  const content = await getContent(NonComplianceSummaryTemplate({ rows, periodLabel }));

  return sendAccountabilityEmail(
    {
      subject: `Public Cloud non-compliance summary — ${periodLabel}`,
      to: recipients,
      cc: [IS_PROD ? publicCloudTeamEmail : ''],
      body: content,
    },
    {
      templateKey: 'NON_COMPLIANCE_SUMMARY',
      scenario: periodLabel,
      metadata: { rowCount: rows.length },
      useSafeSend: false,
    },
  );
}

export async function sendEscalationListSummaryEmail() {
  const products = await prisma.publicCloudProduct.findMany({
    where: { status: ProjectStatus.ACTIVE },
    select: { licencePlate: true, name: true },
  });

  const states = await prisma.cloudCostAccountabilityState.findMany({
    where: { licencePlate: { in: products.map((p) => p.licencePlate) } },
  });
  const stateMap = new Map(states.map((s) => [s.licencePlate, s]));

  const rows = products
    .filter((p) => stateMap.get(p.licencePlate)?.onEscalationList)
    .map((p) => {
      const state = stateMap.get(p.licencePlate);
      return {
        licencePlate: p.licencePlate,
        name: p.name,
        status: state?.status ?? AccountabilityStatus.FORECAST_REQUIRED,
        highestOpenAlert: state?.highestOpenAlert,
      };
    });

  const recipients = await resolveRoutingEmails('escalationListEmails', async () =>
    _uniqEmails([
      ...(await findUserEmailsByAuthRole(GlobalRole.PublicAdmin)),
      ...(await findUserEmailsByAuthRole(GlobalRole.Admin)),
    ]),
  );
  if (!recipients.length || !rows.length) return;

  const periodLabel = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  const content = await getContent(EscalationListSummaryTemplate({ rows, periodLabel }));

  return sendAccountabilityEmail(
    {
      subject: `Public Cloud escalation list — ${periodLabel}`,
      to: recipients,
      cc: [IS_PROD ? publicCloudTeamEmail : ''],
      body: content,
    },
    {
      templateKey: 'ESCALATION_LIST_SUMMARY',
      scenario: periodLabel,
      metadata: { rowCount: rows.length },
      useSafeSend: false,
    },
  );
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

  return sendAccountabilityEmail(
    {
      subject: `Quarterly sign-off reminder — ${product.name} (${licencePlate})`,
      to: [poEmail],
      body: content,
    },
    {
      licencePlate,
      templateKey: 'QUARTERLY_SIGN_OFF_REMINDER',
      scenario: `Q${quarter}-FY${fiscalYear}`,
      metadata: { quarter, fiscalYear, daysUntilMPlusOne },
    },
  );
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

  return sendAccountabilityEmail(
    {
      subject: `[Escalation] Q${quarter} accountability incomplete — ${name} (${licencePlate})`,
      to: directorEmails,
      cc: _compact([...teamEmails, IS_PROD ? publicCloudTeamEmail : '']),
      body: content,
    },
    {
      licencePlate,
      templateKey: 'QUARTERLY_ESCALATION',
      scenario: `Q${quarter}-FY${fiscalYear}`,
      metadata: { quarter, fiscalYear },
      useSafeSend: false,
    },
  );
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
  const teamTemplateKey =
    alert.alertType === 'MILESTONE'
      ? 'CONSUMPTION_MILESTONE'
      : alert.alertType === 'PACE'
        ? 'CONSUMPTION_PACE_WARNING'
        : `COST_ALERT_${alert.alertType}`;

  // CSP ingestion can repost the same alert while it stays open; only email once per
  // billing period (per milestone tier for milestone alerts).
  const baseScenario = billingPeriodScenario(alert.billingPeriod.year, alert.billingPeriod.month);
  const scenario =
    alert.alertType === 'MILESTONE' && alert.milestonePercent != null
      ? `${baseScenario}:m${alert.milestonePercent}`
      : baseScenario;
  const metadata = {
    alertType: alert.alertType,
    periodYear: alert.billingPeriod.year,
    periodMonth: alert.billingPeriod.month,
  };

  const teamAlreadySent = await hasAccountabilityNotificationForScenario(alert.licencePlate, teamTemplateKey, scenario);

  if (emails.length && !teamAlreadySent) {
    const teamContent = await buildTeamAlertContent(name, alert);
    await sendAccountabilityEmail(
      {
        subject: teamAlertSubject(name, alert),
        to: emails,
        body: teamContent,
      },
      {
        licencePlate: alert.licencePlate,
        templateKey: teamTemplateKey,
        scenario,
        metadata,
      },
    );
  }

  const varianceLevels: AccountabilityAlertLevel[] = [
    AccountabilityAlertLevel.A1,
    AccountabilityAlertLevel.A2,
    AccountabilityAlertLevel.A3,
  ];

  if (varianceLevels.includes(alert.alertType as AccountabilityAlertLevel)) {
    const level = alert.alertType as AccountabilityAlertLevel;
    const adminTemplateKey = `COST_ALERT_${level}_ADMIN`;
    const adminAlreadySent = await hasAccountabilityNotificationForScenario(
      alert.licencePlate,
      adminTemplateKey,
      scenario,
    );

    const adminEmails = adminAlreadySent ? [] : await getAdminAlertEmails(level);
    if (adminEmails.length) {
      const adminContent = await buildAdminAlertContent(name, alert, level);
      await sendAccountabilityEmail(
        {
          subject: `[Admin] ${level} variance alert — ${name} (${alert.licencePlate})`,
          to: adminEmails,
          cc: [IS_PROD ? publicCloudTeamEmail : ''],
          body: adminContent,
        },
        {
          licencePlate: alert.licencePlate,
          templateKey: adminTemplateKey,
          scenario,
          metadata,
        },
      );
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

  const recipients = await resolveRoutingEmails('monthlyRecapEmails', async () =>
    _uniqEmails([
      ...(await findUserEmailsByAuthRole(GlobalRole.PublicAdmin)),
      ...(await findUserEmailsByAuthRole(GlobalRole.BillingReviewer)),
      ...(await findUserEmailsByAuthRole(GlobalRole.BillingManager)),
    ]),
  );

  if (!recipients.length) return;

  return sendAccountabilityEmail(
    {
      subject: `Public Cloud monthly accountability recap — ${periodLabel}`,
      to: recipients,
      cc: [IS_PROD ? publicCloudTeamEmail : ''],
      body: content,
    },
    {
      templateKey: 'MONTHLY_ACCOUNTABILITY_RECAP',
      scenario: periodLabel,
      metadata: { rowCount: rows.length },
      useSafeSend: false,
    },
  );
}

export async function maybeSendPreemptiveThresholdNotice(snapshot: CloudSpendSnapshot) {
  const rules = await getActiveCloudCostRulesConfig();
  const dayOfMonth = snapshot.dayOfMonth ?? new Date(snapshot.asOfDate).getDate();
  const pace = rules.earlyPaceWarning;

  const shouldSend = evaluatePreemptiveNotice(snapshot.forecastAmount, snapshot.amountToDate, dayOfMonth, pace);
  if (!shouldSend) return;

  const scenario = billingPeriodScenario(snapshot.periodYear, snapshot.periodMonth);
  const alreadySent = await hasAccountabilityNotificationForScenario(
    snapshot.licencePlate,
    'PREEMPTIVE_THRESHOLD',
    scenario,
  );
  if (alreadySent) return;

  const { emails, name } = await getProductTeamEmails(snapshot.licencePlate);
  if (!emails.length) return;

  const content = await getContent(
    PreemptiveThresholdNoticeTemplate({
      productName: name,
      licencePlate: snapshot.licencePlate,
      spendToDate: snapshot.amountToDate,
      forecastAmount: snapshot.forecastAmount,
      projectedMonthEnd: snapshot.projectedMonthEnd,
      varianceAmount: snapshot.varianceAmount,
      variancePercent: snapshot.variancePercent,
      consumptionPercentOfForecast: snapshot.consumptionPercent,
      currency: snapshot.currency,
      preemptiveDayOfMonth: pace.preemptiveByDayOfMonth ?? undefined,
      preemptivePercent: pace.preemptivePercentOfForecast ?? undefined,
    }),
  );

  await sendAccountabilityEmail(
    {
      subject: `Pre-emptive spend notice (A0) — ${name}`,
      to: emails,
      body: content,
    },
    {
      licencePlate: snapshot.licencePlate,
      templateKey: 'PREEMPTIVE_THRESHOLD',
      scenario,
      metadata: {
        periodYear: snapshot.periodYear,
        periodMonth: snapshot.periodMonth,
        dayOfMonth,
        preemptivePercent: pace.preemptivePercentOfForecast,
        preemptiveDayOfMonth: pace.preemptiveByDayOfMonth,
      },
    },
  );
}
