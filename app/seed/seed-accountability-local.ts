/**
 * Seed CSP consumption data and an approved forecast for local accountability testing.
 * Run: pnpm run seed-accountability-local [licencePlate] [--reset] [--skip-forecast]
 *
 * Default licence plate: e71b0e (Cost Model Test 1)
 */
import {
  buildRollingFiscalForecastMonths,
  FISCAL_FORECAST_HORIZON_MONTHS,
} from '../components/public-cloud/accountability/forecast-grid-utils';
import prisma from '../core/prisma';
import { getCurrentBillingPeriod } from '../helpers/accountability-periods';
import { Provider } from '../prisma/client';
import { seedDefaultCloudCostRulesConfig } from '../services/db/cloud-cost-rules';
import {
  approveForecast,
  createForecastDraft,
  getActiveApprovedForecast,
  recordConsumptionAlert,
  recomputeAccountabilityState,
  seedForecastFromProductBudget,
  submitForecast,
  upsertConsumptionHistory,
  upsertConsumptionSnapshot,
} from '../services/db/public-cloud-accountability';

const DEFAULT_PLATE = 'e71b0e';
const ADMIN_EMAIL = 'admin.system@gov.bc.ca';
const DEFAULT_MONTHLY_FORECAST_AZURE = 5000;
const DEFAULT_MONTHLY_FORECAST_AWS = 4000;

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const licencePlate = args.find((a) => !a.startsWith('--')) ?? DEFAULT_PLATE;
  return {
    licencePlate,
    reset: flags.has('--reset'),
    skipForecast: flags.has('--skip-forecast'),
  };
}

function billingPeriodMonthsBack(count: number) {
  const now = new Date();
  const periods: { year: number; month: number }[] = [];
  for (let i = count; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return periods;
}

async function clearAccountabilityData(licencePlate: string) {
  await prisma.accountabilityAlert.deleteMany({ where: { licencePlate } });
  await prisma.cloudSpendSnapshot.deleteMany({ where: { licencePlate } });
  await prisma.cloudSpendHistory.deleteMany({ where: { licencePlate } });
  await prisma.cloudCostForecast.deleteMany({ where: { licencePlate } });
  await prisma.quarterlyForecastReview.deleteMany({ where: { licencePlate } });
  await prisma.cloudCostAccountabilityState.deleteMany({ where: { licencePlate } });
}

async function ensureApprovedForecast(
  licencePlate: string,
  userId: string,
  product: {
    provider: Provider;
    budget: { dev: number; test: number; prod: number; tools: number };
    environmentsEnabled: {
      development: boolean;
      test: boolean;
      production: boolean;
      tools: boolean;
    };
  },
) {
  const existing = await getActiveApprovedForecast(licencePlate);
  if (existing) {
    console.log(`  approved forecast v${existing.version} already exists — skipped`);
    return existing;
  }

  const monthlyValues =
    monthlyForecastTotal(product) > 0
      ? seedForecastFromProductBudget(product.provider, product.budget, product.environmentsEnabled)
      : buildMonthlyValues(product, resolveMonthlyForecastAmount(product));
  const draft = await createForecastDraft(licencePlate, monthlyValues, FISCAL_FORECAST_HORIZON_MONTHS);
  await submitForecast(licencePlate, draft.id, userId);
  const approved = await approveForecast(licencePlate, draft.id, userId);
  console.log(`  created and approved forecast v${approved.version}`);
  return approved;
}

function monthlyForecastTotal(product: {
  provider: Provider;
  budget: { dev: number; test: number; prod: number; tools: number };
  environmentsEnabled: {
    development: boolean;
    test: boolean;
    production: boolean;
    tools: boolean;
  };
}) {
  let total = 0;
  if (product.environmentsEnabled.development) total += product.budget.dev;
  if (product.environmentsEnabled.test) total += product.budget.test;
  if (product.environmentsEnabled.production) total += product.budget.prod;
  if (product.environmentsEnabled.tools) total += product.budget.tools;
  return total;
}

function resolveMonthlyForecastAmount(product: {
  provider: Provider;
  budget: { dev: number; test: number; prod: number; tools: number };
  environmentsEnabled: {
    development: boolean;
    test: boolean;
    production: boolean;
    tools: boolean;
  };
}) {
  const fromBudget = monthlyForecastTotal(product);
  if (fromBudget > 0) return fromBudget;
  return product.provider === Provider.AZURE ? DEFAULT_MONTHLY_FORECAST_AZURE : DEFAULT_MONTHLY_FORECAST_AWS;
}

function buildMonthlyValues(
  product: { provider: Provider },
  monthlyAmount: number,
  horizonMonths = FISCAL_FORECAST_HORIZON_MONTHS,
) {
  const currency = product.provider === Provider.AZURE ? 'CAD' : 'USD';
  return buildRollingFiscalForecastMonths(monthlyAmount, currency, new Date(), horizonMonths);
}

function printWalkthrough(licencePlate: string) {
  const base = `http://localhost:3000/public-cloud/products/${licencePlate}/edit`;

  console.log('\n--- Accountability walkthrough checklist ---\n');
  console.log('Prerequisites: sandbox running, pnpm run dev, logged in as admin.system@gov.bc.ca\n');
  console.log('1. Product costs tab');
  console.log(`   http://localhost:3000/public-cloud/products/${licencePlate}/costs`);
  console.log('   - Total spend to date, forecast, projected month-end, account breakdown');
  console.log('   - Data as-of timestamp from CSP\n');
  console.log('2. Product accountability tab');
  console.log(`   ${base}`);
  console.log('   - Status may show FORECAST REVIEW REQUIRED until quarterly PO sign-off (past M+1)');
  console.log('   - After PO sign-off, status should show VARIANCE REVIEW REQUIRED (open A1 alert)');
  console.log('   - Current month spend: forecast, spend-to-date, projected month-end, variance');
  console.log('   - Account breakdown table (dev / test / prod)');
  console.log('   - Past spend table (3 closed months from CSP history)');
  console.log('   - Active approved forecast grid (read-only)\n');
  console.log('3. Quarterly review (do this before resolving alerts)');
  console.log('   - Complete checklist items (forecast months, members, spend lookback)');
  console.log('   - PO sign-off — status should change to VARIANCE REVIEW REQUIRED\n');
  console.log('4. Open alerts (after quarterly sign-off)');
  console.log('   - A1 alert listed — Acknowledge, then Resolve with a reason\n');
  console.log('5. Admin governance');
  console.log('   http://localhost:3000/public-cloud/accountability/all');
  console.log('   http://localhost:3000/public-cloud/accountability/compliance\n');
  console.log('6. Rules config (optional)');
  console.log('   http://localhost:3000/admin/public-cloud/cost-rules\n');
  console.log('Re-seed: pnpm run seed-accountability-local -- --reset');
  console.log('Forecast UI only (no auto-approve): pnpm run seed-accountability-local -- --skip-forecast --reset\n');
}

export async function seedAccountabilityForProduct(
  licencePlate: string,
  options: { reset?: boolean; skipForecast?: boolean; showWalkthrough?: boolean } = {},
) {
  const { reset = false, skipForecast = false, showWalkthrough = false } = options;

  console.log(`Seeding accountability demo data for ${licencePlate}...`);

  const product = await prisma.publicCloudProduct.findFirst({ where: { licencePlate } });
  if (!product) {
    throw new Error(
      `No product found for licence plate "${licencePlate}". Run pnpm run seed-all-local or create a product first.`,
    );
  }

  const adminUser = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL } });
  if (!adminUser) {
    throw new Error(`User ${ADMIN_EMAIL} not found. Run pnpm run seed-local first.`);
  }

  await seedDefaultCloudCostRulesConfig();

  if (reset) {
    console.log('  clearing existing accountability data...');
    await clearAccountabilityData(licencePlate);
  }

  const forecastAmount = resolveMonthlyForecastAmount(product);
  const currency: 'USD' | 'CAD' = product.provider === Provider.AZURE ? 'CAD' : 'USD';

  if (!skipForecast) {
    console.log('Forecast:');
    await ensureApprovedForecast(licencePlate, adminUser.id, product);
  } else {
    console.log('Forecast: skipped (--skip-forecast)');
  }

  const { year, month } = getCurrentBillingPeriod();
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  const spendToDate = Math.round(forecastAmount * 0.64);
  const projectedMonthEnd = Math.round(forecastAmount * 1.1);
  const varianceAmount = projectedMonthEnd - forecastAmount;
  const variancePercent = forecastAmount > 0 ? (varianceAmount / forecastAmount) * 100 : 0;
  const consumptionPercentOfForecast = forecastAmount > 0 ? (spendToDate / forecastAmount) * 100 : 0;

  console.log('CSP consumption snapshot:');
  await upsertConsumptionSnapshot({
    licencePlate,
    provider: product.provider,
    currency,
    billingPeriod: { year, month },
    asOf: now.toISOString(),
    spendToDate,
    projectedMonthEnd,
    currentMonthForecast: forecastAmount,
    varianceAmount,
    variancePercent,
    consumptionPercentOfForecast,
    dayOfMonth,
    daysInMonth,
    accounts: [
      {
        accountId: `${licencePlate}-dev`,
        environment: 'dev',
        spendToDate: Math.round(spendToDate * 0.35),
        currency,
      },
      {
        accountId: `${licencePlate}-test`,
        environment: 'test',
        spendToDate: Math.round(spendToDate * 0.25),
        currency,
      },
      {
        accountId: `${licencePlate}-prod`,
        environment: 'prod',
        spendToDate: Math.round(spendToDate * 0.4),
        currency,
      },
    ],
  });
  console.log(`  ${currency} forecast ${forecastAmount}, spend ${spendToDate}, projected ${projectedMonthEnd}`);

  console.log('CSP spend history (3 closed months):');
  const historyMonths = billingPeriodMonthsBack(3).map((period, index) => {
    const actual = Math.round(forecastAmount * (0.88 + index * 0.04));
    const variance = actual - forecastAmount;
    const variancePct = forecastAmount > 0 ? (variance / forecastAmount) * 100 : 0;
    return {
      billingPeriod: period,
      currency,
      actualTotal: actual,
      forecastTotal: forecastAmount,
      varianceAmount: variance,
      variancePercent: variancePct,
    };
  });
  await upsertConsumptionHistory({
    licencePlate,
    provider: product.provider,
    months: historyMonths,
  });
  console.log(`  ${historyMonths.length} months`);

  console.log('CSP alert (A1 variance):');
  await recordConsumptionAlert({
    licencePlate,
    provider: product.provider,
    currency,
    billingPeriod: { year, month },
    triggeredAt: now.toISOString(),
    alertType: 'A1',
    spendToDate,
    projectedMonthEnd,
    currentMonthForecast: forecastAmount,
    varianceAmount,
    variancePercent,
    consumptionPercentOfForecast,
    ruleKey: 'local-seed-a1',
  });
  console.log('  A1 alert recorded');

  await recomputeAccountabilityState(licencePlate);
  const state = await prisma.cloudCostAccountabilityState.findUnique({ where: { licencePlate } });
  console.log(`\nAccountability status: ${state?.status ?? 'unknown'}`);
  console.log(`Highest open alert: ${state?.highestOpenAlert ?? 'none'}`);

  if (showWalkthrough) {
    printWalkthrough(licencePlate);
  }
}

// CLI entry (below export)
async function runCli() {
  const { licencePlate, reset, skipForecast } = parseArgs();
  await seedAccountabilityForProduct(licencePlate, { reset, skipForecast, showWalkthrough: true });
}

if (require.main === module) {
  runCli()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
