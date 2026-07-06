import {
  applyPercentGrowthToEditableMonths,
  buildFiscalForecastMonths,
  copyAmountAcrossEditableMonths,
  formatFiscalYearLabel,
  getFiscalYearChunks,
  getFiscalYearStartYear,
  getCellStatuses,
  mergeMonthlyValuesOntoFiscalHorizon,
  preserveLockedPastMonthlyValues,
  type ForecastCellStatus,
  type MonthlyValue,
} from './forecast-grid-utils';

describe('fiscal year helpers', () => {
  const june2026 = new Date(2026, 5, 15);

  it('labels fiscal years as FY26/27', () => {
    expect(formatFiscalYearLabel(2026)).toBe('FY26/27');
    expect(formatFiscalYearLabel(2025)).toBe('FY25/26');
  });

  it('starts fiscal year in April', () => {
    expect(getFiscalYearStartYear(new Date(2026, 2, 1))).toBe(2025);
    expect(getFiscalYearStartYear(new Date(2026, 3, 1))).toBe(2026);
  });

  it('builds 3 fiscal years from April', () => {
    const months = buildFiscalForecastMonths(3, 1000, 'CAD', june2026);
    expect(months.length).toBe(36);
    expect(months[0]).toMatchObject({ year: 2026, month: 4, amount: 1000 });
    expect(months[11]).toMatchObject({ year: 2027, month: 3 });
    expect(months[12]).toMatchObject({ year: 2027, month: 4 });
  });

  it('chunks months by fiscal year with labels', () => {
    const months = buildFiscalForecastMonths(3, 1000, 'CAD', june2026);
    const chunks = getFiscalYearChunks(months);
    expect(chunks.length).toBe(3);
    expect(chunks[0].label).toBe('FY26/27');
    expect(chunks[1].label).toBe('FY27/28');
    expect(chunks[2].label).toBe('FY28/29');
    expect(chunks[0].months.length).toBe(12);
  });

  it('merges existing values onto fiscal horizon', () => {
    const existing: MonthlyValue[] = [
      { year: 2026, month: 6, amount: 5000, currency: 'CAD' },
      { year: 2026, month: 7, amount: 5500, currency: 'CAD' },
    ];
    const merged = mergeMonthlyValuesOntoFiscalHorizon(existing, 3, 'CAD', june2026);
    expect(merged.length).toBe(36);
    expect(merged.find((m) => m.month === 6)?.amount).toBe(5000);
    expect(merged.find((m) => m.month === 5)?.amount).toBe(0);
  });
});

const baseValues: MonthlyValue[] = [
  { year: 2026, month: 1, amount: 1000, currency: 'CAD' },
  { year: 2026, month: 2, amount: 1000, currency: 'CAD' },
  { year: 2026, month: 3, amount: 1000, currency: 'CAD' },
  { year: 2026, month: 4, amount: 1000, currency: 'CAD' },
];

describe('applyPercentGrowthToEditableMonths', () => {
  it('applies compound growth across editable months', () => {
    const statuses: ForecastCellStatus[] = ['confirmed', 'suggested', 'suggested', 'needsReview'];

    const result = applyPercentGrowthToEditableMonths(baseValues, statuses, 10);

    expect(result[0].amount).toBe(1000);
    expect(result[1].amount).toBe(1100);
    expect(result[2].amount).toBe(1210);
    expect(result[3].amount).toBe(1331);
  });
});

describe('copyAmountAcrossEditableMonths', () => {
  it('copies source amount to editable months only', () => {
    const statuses: ForecastCellStatus[] = ['confirmed', 'suggested', 'needsReview', 'confirmed'];

    const result = copyAmountAcrossEditableMonths(baseValues, statuses, 0);

    expect(result.map((v) => v.amount)).toEqual([1000, 1000, 1000, 1000]);
  });
});

describe('getCellStatuses', () => {
  const june2026 = new Date(2026, 5, 15);

  it('locks past months even when quarterly review is due for the current quarter', () => {
    const values = buildFiscalForecastMonths(3, 1000, 'CAD', june2026);
    const statuses = getCellStatuses(values, {
      quarterlyReview: { poSignedOff: false, status: 'IN_PROGRESS' },
      activeBaseline: null,
      confirmedKeys: new Set(),
      editable: true,
      now: june2026,
    });

    const aprilIndex = values.findIndex((v) => v.month === 4 && v.year === 2026);
    const mayIndex = values.findIndex((v) => v.month === 5 && v.year === 2026);
    const juneIndex = values.findIndex((v) => v.month === 6 && v.year === 2026);

    expect(statuses[aprilIndex]).toBe('past');
    expect(statuses[mayIndex]).toBe('past');
    expect(statuses[juneIndex]).toBe('needsReview');
  });
});

describe('preserveLockedPastMonthlyValues', () => {
  const june2026 = new Date(2026, 5, 15);

  it('reverts changes to past months from baseline', () => {
    const baseline = buildFiscalForecastMonths(3, 1000, 'CAD', june2026);
    const proposed = baseline.map((v) => ({ ...v, amount: 9999 }));

    const result = preserveLockedPastMonthlyValues(baseline, proposed, june2026);

    const april = result.find((v) => v.month === 4 && v.year === 2026);
    const july = result.find((v) => v.month === 7 && v.year === 2026);

    expect(april?.amount).toBe(1000);
    expect(july?.amount).toBe(9999);
  });
});
