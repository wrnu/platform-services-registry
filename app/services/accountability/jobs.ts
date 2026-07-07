import prisma from '@/core/prisma';
import { QuarterlyReviewStatus, ProjectStatus } from '@/prisma/client';
import {
  sendMonthlyAccountabilityRecapEmail,
  sendNonComplianceSummaryEmail,
  sendEscalationListSummaryEmail,
  sendQuarterlyEscalationEmail,
  sendQuarterlyForecastReminderEmail,
  sendWeeklySignOffReminderEmail,
  getMPlusOneDate,
} from '@/services/ches/public-cloud/accountability-emails';
import { getActiveCloudCostRulesConfig } from '@/services/db/cloud-cost-rules';
import {
  getOrCreateCurrentQuarterlyReview,
  recomputeAccountabilityState,
} from '@/services/db/public-cloud-accountability';

function getCurrentFiscalQuarter(date = new Date()) {
  const month = date.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return { fiscalYear: date.getFullYear(), quarter };
}

function isQuarterStartMonth(month: number, quarterStartMonths: number[]) {
  return quarterStartMonths.includes(month);
}

export async function runQuarterlyReminderJob() {
  const rules = await getActiveCloudCostRulesConfig();
  const now = new Date();
  const month = now.getMonth() + 1;

  if (!isQuarterStartMonth(month, rules.forecastPolicy.quarterStartMonths)) {
    return { sent: 0, skipped: 'not quarter start month' };
  }

  const { fiscalYear, quarter } = getCurrentFiscalQuarter(now);
  const products = await prisma.publicCloudProduct.findMany({
    where: { status: ProjectStatus.ACTIVE },
    select: { licencePlate: true },
  });

  let sent = 0;
  for (const product of products) {
    await getOrCreateCurrentQuarterlyReview(product.licencePlate);
    await sendQuarterlyForecastReminderEmail(product.licencePlate, quarter, fiscalYear);
    sent += 1;
  }

  await sendNonComplianceSummaryEmail();
  await sendEscalationListSummaryEmail();

  return { sent };
}

export async function runWeeklySignOffReminderJob() {
  const rules = await getActiveCloudCostRulesConfig();
  if (!rules.reminderPolicy.weeklyUntilSignOff) {
    return { sent: 0, skipped: 'weekly reminders disabled' };
  }

  const now = new Date();
  if (now.getDay() !== 1) {
    return { sent: 0, skipped: 'not Monday' };
  }

  const { fiscalYear, quarter } = getCurrentFiscalQuarter(now);
  const pending = await prisma.quarterlyForecastReview.findMany({
    where: {
      fiscalYear,
      quarter,
      poSignedOff: false,
      status: QuarterlyReviewStatus.PENDING,
    },
    select: { licencePlate: true },
  });

  let sent = 0;
  for (const review of pending) {
    await sendWeeklySignOffReminderEmail(review.licencePlate, quarter, fiscalYear);
    sent += 1;
  }

  return { sent };
}

export async function runMonthlyRecapJob() {
  const rules = await getActiveCloudCostRulesConfig();
  const now = new Date();
  const dayOfMonth = now.getDate();

  if (dayOfMonth !== rules.monthlyRecapDayOfMonth) {
    return { sent: 0, skipped: 'not recap day' };
  }

  await sendMonthlyAccountabilityRecapEmail();
  return { sent: 1 };
}

export async function runMPlusOneEscalationJob() {
  const rules = await getActiveCloudCostRulesConfig();
  if (!rules.reminderPolicy.escalateAtMPlusOne) {
    return { escalated: 0, skipped: 'escalation disabled' };
  }

  const { fiscalYear, quarter } = getCurrentFiscalQuarter();
  const mPlusOne = getMPlusOneDate(fiscalYear, quarter);
  const now = new Date();

  if (now < mPlusOne) {
    return { escalated: 0, skipped: 'before M+1' };
  }

  const pending = await prisma.quarterlyForecastReview.findMany({
    where: {
      fiscalYear,
      quarter,
      poSignedOff: false,
      status: QuarterlyReviewStatus.PENDING,
    },
  });

  let escalated = 0;
  let emailsSent = 0;
  for (const review of pending) {
    await prisma.quarterlyForecastReview.update({
      where: { id: review.id },
      data: {
        status: QuarterlyReviewStatus.ESCALATED,
        escalatedAt: new Date(),
      },
    });
    await recomputeAccountabilityState(review.licencePlate);
    await sendQuarterlyEscalationEmail(review.licencePlate, quarter, fiscalYear);
    escalated += 1;
    emailsSent += 1;
  }

  await sendEscalationListSummaryEmail();

  return { escalated, emailsSent };
}

export type AccountabilityJobName =
  | 'quarterly-reminder'
  | 'weekly-signoff-reminder'
  | 'monthly-recap'
  | 'm-plus-one-escalation';

export async function runAccountabilityJob(job: AccountabilityJobName) {
  switch (job) {
    case 'quarterly-reminder':
      return runQuarterlyReminderJob();
    case 'weekly-signoff-reminder':
      return runWeeklySignOffReminderJob();
    case 'monthly-recap':
      return runMonthlyRecapJob();
    case 'm-plus-one-escalation':
      return runMPlusOneEscalationJob();
    default:
      throw new Error(`Unknown job: ${job}`);
  }
}
