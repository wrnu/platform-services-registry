export type MonthlyValue = {
  year: number;
  month: number;
  amount: number;
  currency: string;
};

export type ForecastCellStatus = 'confirmed' | 'needsReview' | 'suggested' | 'past';

/** Current fiscal year plus two future fiscal years (April–March). */
export const FISCAL_FORECAST_YEARS = 3;
export const FISCAL_FORECAST_HORIZON_MONTHS = FISCAL_FORECAST_YEARS * 12;

const FISCAL_YEAR_START_MONTH = 4;

export function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

export function getFiscalYearStartForMonth(year: number, month: number) {
  return month >= FISCAL_YEAR_START_MONTH ? year : year - 1;
}

export function getFiscalYearStartYear(date = new Date()) {
  return getFiscalYearStartForMonth(date.getFullYear(), date.getMonth() + 1);
}

export function formatFiscalYearLabel(fiscalStartYear: number) {
  const start = String(fiscalStartYear).slice(-2);
  const end = String(fiscalStartYear + 1).slice(-2);
  return `FY${start}/${end}`;
}

export function shortMonthLabel(year: number, month: number) {
  const mon = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return `${mon} '${String(year).slice(-2)}`;
}

export function yearRangeLabel(values: MonthlyValue[]) {
  if (!values.length) return '';
  const first = values[0];
  const last = values[values.length - 1];
  const fmt = (y: number, m: number) =>
    new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return `${fmt(first.year, first.month)} – ${fmt(last.year, last.month)}`;
}

export function formatForecastAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function sumMonthlyValues(values: MonthlyValue[]) {
  return values.reduce((sum, v) => sum + v.amount, 0);
}

export function buildFiscalForecastMonths(
  horizonFiscalYears: number,
  monthlyAmount: number,
  currency: string,
  now = new Date(),
): MonthlyValue[] {
  const fiscalStartYear = getFiscalYearStartYear(now);
  const startDate = new Date(fiscalStartYear, FISCAL_YEAR_START_MONTH - 1, 1);
  const monthCount = horizonFiscalYears * 12;
  const monthlyValues: MonthlyValue[] = [];

  for (let i = 0; i < monthCount; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    monthlyValues.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      amount: monthlyAmount,
      currency,
    });
  }

  return monthlyValues;
}

export function mergeMonthlyValuesOntoFiscalHorizon(
  existing: MonthlyValue[],
  horizonFiscalYears = FISCAL_FORECAST_YEARS,
  currency = 'CAD',
  now = new Date(),
): MonthlyValue[] {
  const template = buildFiscalForecastMonths(horizonFiscalYears, 0, currency, now);
  const byKey = new Map(existing.map((v) => [monthKey(v.year, v.month), v]));

  return template.map((slot) => {
    const found = byKey.get(monthKey(slot.year, slot.month));
    if (found) {
      return { ...found, currency: found.currency || currency };
    }
    return slot;
  });
}

export function chunkByFiscalYear(values: MonthlyValue[]) {
  const chunks: MonthlyValue[][] = [];
  let currentFyStart: number | null = null;
  let currentChunk: MonthlyValue[] = [];

  for (const value of values) {
    const fyStart = getFiscalYearStartForMonth(value.year, value.month);
    if (currentFyStart !== null && fyStart !== currentFyStart) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentFyStart = fyStart;
    currentChunk.push(value);
  }

  if (currentChunk.length) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export type FiscalYearChunk = {
  fiscalStartYear: number;
  label: string;
  months: MonthlyValue[];
  startIndex: number;
};

export function getFiscalYearChunks(values: MonthlyValue[]): FiscalYearChunk[] {
  const chunks = chunkByFiscalYear(values);
  let startIndex = 0;

  return chunks.map((months) => {
    const fiscalStartYear = getFiscalYearStartForMonth(months[0].year, months[0].month);
    const chunk = {
      fiscalStartYear,
      label: formatFiscalYearLabel(fiscalStartYear),
      months,
      startIndex,
    };
    startIndex += months.length;
    return chunk;
  });
}

/** @deprecated Use chunkByFiscalYear for forecast grids. */
export function chunkByYear(values: MonthlyValue[], monthsPerYear = 12) {
  const chunks: MonthlyValue[][] = [];
  for (let i = 0; i < values.length; i += monthsPerYear) {
    chunks.push(values.slice(i, i + monthsPerYear));
  }
  return chunks;
}

type QuarterlyReviewHint = {
  poSignedOff: boolean;
  status?: string;
} | null;

export function getCurrentQuarterMonthKeys(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarterStart = Math.floor((month - 1) / 3) * 3 + 1;
  return [0, 1, 2].map((i) => monthKey(year, quarterStart + i));
}

export function getReviewWindowStartIndex(values: MonthlyValue[], now = new Date()) {
  const quarterKeys = getCurrentQuarterMonthKeys(now);
  for (let i = 0; i < values.length; i++) {
    const key = monthKey(values[i].year, values[i].month);
    if (quarterKeys.includes(key)) return i;
  }
  return -1;
}

export function isPastMonth(year: number, month: number, now = new Date()) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year < currentYear || (year === currentYear && month < currentMonth);
}

export function getCellStatuses(
  values: MonthlyValue[],
  options: {
    quarterlyReview: QuarterlyReviewHint;
    activeBaseline: MonthlyValue[] | null;
    confirmedKeys: Set<string>;
    editable: boolean;
    now?: Date;
  },
): ForecastCellStatus[] {
  const { quarterlyReview, confirmedKeys, editable, now = new Date() } = options;
  const reviewDue =
    editable && quarterlyReview && !quarterlyReview.poSignedOff && quarterlyReview.status !== 'COMPLETE';

  const quarterKeys = reviewDue ? new Set(getCurrentQuarterMonthKeys(now)) : new Set<string>();

  return values.map((v) => {
    const key = monthKey(v.year, v.month);

    if (isPastMonth(v.year, v.month, now)) {
      if (!editable) return 'confirmed';
      return 'past';
    }

    if (confirmedKeys.has(key)) return 'confirmed';

    if (quarterKeys.has(key)) return 'needsReview';

    if (!editable) return 'confirmed';

    return 'suggested';
  });
}

export function getInitialConfirmedKeys(
  values: MonthlyValue[],
  _activeBaseline: MonthlyValue[] | null,
  _quarterlyReview: QuarterlyReviewHint,
  now = new Date(),
) {
  const keys = new Set<string>();

  values.forEach((v) => {
    if (isPastMonth(v.year, v.month, now)) {
      keys.add(monthKey(v.year, v.month));
    }
  });

  return keys;
}

/** Keep past-month amounts from baseline; only current/future months may change. */
export function preserveLockedPastMonthlyValues(
  baseline: MonthlyValue[],
  proposed: MonthlyValue[],
  now = new Date(),
): MonthlyValue[] {
  const baselineByKey = new Map(baseline.map((v) => [monthKey(v.year, v.month), v]));

  return proposed.map((v) => {
    if (isPastMonth(v.year, v.month, now)) {
      return baselineByKey.get(monthKey(v.year, v.month)) ?? v;
    }
    return v;
  });
}

export function countCellsAwaitingForecast(statuses: ForecastCellStatus[]) {
  return statuses.filter((s) => s === 'needsReview' || s === 'suggested').length;
}

function isEditableForecastCell(status: ForecastCellStatus) {
  return status === 'suggested' || status === 'needsReview';
}

/** Apply compound % growth from each month's prior value across editable cells. */
export function applyPercentGrowthToEditableMonths(
  values: MonthlyValue[],
  statuses: ForecastCellStatus[],
  growthPercent: number,
): MonthlyValue[] {
  const factor = 1 + growthPercent / 100;
  const next = values.map((v) => ({ ...v }));

  for (let i = 1; i < next.length; i++) {
    if (isEditableForecastCell(statuses[i])) {
      next[i] = { ...next[i], amount: Math.round(next[i - 1].amount * factor) };
    }
  }

  return next;
}

/** Copy a source month's amount to all editable cells. */
export function copyAmountAcrossEditableMonths(
  values: MonthlyValue[],
  statuses: ForecastCellStatus[],
  sourceIndex: number,
): MonthlyValue[] {
  const sourceAmount = values[sourceIndex]?.amount ?? 0;
  return values.map((v, i) => (isEditableForecastCell(statuses[i]) ? { ...v, amount: sourceAmount } : v));
}
