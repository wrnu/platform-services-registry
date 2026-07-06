'use client';

import { Alert, Button, NumberInput, Popover, TextInput } from '@mantine/core';
import { IconCheck, IconPencil } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { updatePublicCloudForecast } from '@/services/backend/public-cloud/accountability';
import {
  applyPercentGrowthToEditableMonths,
  copyAmountAcrossEditableMonths,
  countCellsAwaitingForecast,
  FISCAL_FORECAST_HORIZON_MONTHS,
  FISCAL_FORECAST_YEARS,
  formatForecastAmount,
  getCellStatuses,
  getFiscalYearChunks,
  getInitialConfirmedKeys,
  getReviewWindowStartIndex,
  isPastMonth,
  mergeMonthlyValuesOntoFiscalHorizon,
  monthKey,
  preserveLockedPastMonthlyValues,
  shortMonthLabel,
  sumMonthlyValues,
  yearRangeLabel,
  type ForecastCellStatus,
  type MonthlyValue,
} from './forecast-grid-utils';

type QuarterlyReview = {
  poSignedOff: boolean;
  status?: string;
};

type ForecastMeta = {
  id: string;
  version: number;
  status: string;
  horizonMonths: number;
  updatedAt?: string;
};

function CellEditor({
  value,
  currency,
  status,
  editable,
  onChange,
}: {
  value: number;
  currency: string;
  status: ForecastCellStatus;
  editable: boolean;
  onChange: (amount: number) => void;
}) {
  if (status === 'past') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[2.25rem]">
        <span className="font-medium text-sm text-gray-400">{formatForecastAmount(value, currency)}</span>
      </div>
    );
  }

  const canEdit = editable && status !== 'confirmed';

  if (canEdit) {
    return (
      <NumberInput
        value={value}
        min={0}
        hideControls
        thousandSeparator=","
        prefix={currency === 'USD' ? '$' : '$'}
        onChange={(val) => onChange(typeof val === 'number' ? val : 0)}
        classNames={{ input: 'text-center font-medium text-sm h-9' }}
        size="sm"
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[2.25rem]">
      <span className={`font-medium text-sm ${status === 'suggested' ? 'text-gray-400' : 'text-gray-900'}`}>
        {formatForecastAmount(value, currency)}
      </span>
      {status === 'suggested' && <span className="text-[10px] uppercase text-gray-400 tracking-wide">suggested</span>}
    </div>
  );
}

export default function ProjectBudgetForecastPanel({
  licencePlate,
  forecast,
  monthlyValues,
  activeBaseline,
  quarterlyReview,
  editable,
  onSaved,
}: {
  licencePlate: string;
  forecast: ForecastMeta;
  monthlyValues: MonthlyValue[];
  activeBaseline: MonthlyValue[] | null;
  quarterlyReview: QuarterlyReview | null;
  editable: boolean;
  onSaved: () => void;
}) {
  const currency = monthlyValues[0]?.currency ?? 'CAD';

  const baselineValues = useMemo(
    () => mergeMonthlyValuesOntoFiscalHorizon(monthlyValues, FISCAL_FORECAST_YEARS, currency),
    [monthlyValues, currency],
  );

  const baselineActive = useMemo(
    () =>
      activeBaseline ? mergeMonthlyValuesOntoFiscalHorizon(activeBaseline, FISCAL_FORECAST_YEARS, currency) : null,
    [activeBaseline, currency],
  );

  const [values, setValues] = useState(baselineValues);
  const [confirmedKeys, setConfirmedKeys] = useState<Set<string>>(() =>
    getInitialConfirmedKeys(baselineValues, baselineActive, quarterlyReview),
  );
  const [reviewBannerDismissed, setReviewBannerDismissed] = useState(false);
  const [growthPercent, setGrowthPercent] = useState('5');

  useEffect(() => {
    setValues(baselineValues);
    setConfirmedKeys(getInitialConfirmedKeys(baselineValues, baselineActive, quarterlyReview));
  }, [baselineValues, baselineActive, quarterlyReview]);

  const cellStatuses = useMemo(
    () =>
      getCellStatuses(values, {
        quarterlyReview,
        activeBaseline: baselineActive,
        confirmedKeys,
        editable,
      }),
    [values, quarterlyReview, baselineActive, confirmedKeys, editable],
  );

  const awaitingCount = countCellsAwaitingForecast(cellStatuses);
  const isDirty = JSON.stringify(values) !== JSON.stringify(baselineValues);
  const fiscalYearChunks = getFiscalYearChunks(values);
  const grandTotal = sumMonthlyValues(values);

  const activeFiscalChunks = baselineActive ? getFiscalYearChunks(baselineActive) : [];
  const activeFiscalTotals = activeFiscalChunks.map((chunk) => sumMonthlyValues(chunk.months));

  const reviewStart = getReviewWindowStartIndex(values);
  const quarterKeys = new Set(
    values.filter((_, i) => cellStatuses[i] === 'needsReview').map((v) => monthKey(v.year, v.month)),
  );
  const reviewMonthLabels = values
    .filter((v) => quarterKeys.has(monthKey(v.year, v.month)))
    .map((v) => shortMonthLabel(v.year, v.month));

  const save = useMutation({
    mutationFn: () => {
      const lockedValues = preserveLockedPastMonthlyValues(baselineValues, values);
      return updatePublicCloudForecast(licencePlate, forecast.id, {
        monthlyValues: lockedValues.map((v) => ({
          year: v.year,
          month: v.month,
          amount: Number(v.amount),
          currency: v.currency as 'USD' | 'CAD',
        })),
        horizonMonths: FISCAL_FORECAST_HORIZON_MONTHS,
      });
    },
    onSuccess: onSaved,
  });

  const updateAmount = (index: number, amount: number) => {
    const cell = values[index];
    if (!cell || isPastMonth(cell.year, cell.month)) return;
    setValues((prev) => prev.map((v, i) => (i === index ? { ...v, amount } : v)));
    const key = monthKey(values[index].year, values[index].month);
    setConfirmedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const confirmAllSuggested = () => {
    const next = new Set(confirmedKeys);
    values.forEach((v, i) => {
      if (cellStatuses[i] !== 'confirmed' && cellStatuses[i] !== 'past') {
        next.add(monthKey(v.year, v.month));
      }
    });
    setConfirmedKeys(next);
  };

  const cellStatusOptions = useMemo(
    () => ({ quarterlyReview, activeBaseline: baselineActive, confirmedKeys, editable }),
    [quarterlyReview, baselineActive, confirmedKeys, editable],
  );

  const applyGrowth = () => {
    const pct = Number(growthPercent) || 0;
    setValues((prev) => {
      const statuses = getCellStatuses(prev, cellStatusOptions);
      return applyPercentGrowthToEditableMonths(prev, statuses, pct);
    });
  };

  const copyAcrossSuggested = () => {
    setValues((prev) => {
      const statuses = getCellStatuses(prev, cellStatusOptions);
      const windowStart = getReviewWindowStartIndex(prev);
      const sourceIndex = windowStart > 0 ? windowStart - 1 : 0;
      return copyAmountAcrossEditableMonths(prev, statuses, sourceIndex);
    });
  };

  const discardChanges = () => {
    setValues(baselineValues);
    setConfirmedKeys(getInitialConfirmedKeys(baselineValues, baselineActive, quarterlyReview));
  };

  const showReviewBanner =
    editable &&
    !reviewBannerDismissed &&
    quarterlyReview &&
    !quarterlyReview.poSignedOff &&
    reviewMonthLabels.length > 0;

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 space-y-1">
        <p>
          All costs are in{' '}
          <span className="font-medium text-gray-800">{currency === 'CAD' ? 'Canadian dollars' : 'US dollars'}</span>.
          Fiscal years run April–March.
        </p>
        <p>
          {FISCAL_FORECAST_YEARS}-year fiscal forecast total:{' '}
          <span className="font-semibold text-gray-900">{formatForecastAmount(grandTotal, currency)}</span>
        </p>
      </div>

      {showReviewBanner && (
        <Alert
          color="red"
          variant="light"
          withCloseButton
          onClose={() => setReviewBannerDismissed(true)}
          title="Quarterly review required"
        >
          <span className="text-sm">
            {reviewMonthLabels.length} months need your forecast. Your team must confirm estimates for the next quarter
            each rolling period. Cells highlighted below require input:{' '}
            <span className="font-medium">{reviewMonthLabels.join(', ')}</span>.
          </span>
        </Alert>
      )}

      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 rounded-md px-3 py-2 bg-white">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500 font-medium">Bulk fill:</span>
            <Popover width={200} position="bottom-start">
              <Popover.Target>
                <Button type="button" size="compact-sm" variant="default">
                  Apply % growth
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <div className="space-y-2">
                  <TextInput
                    label="Growth %"
                    value={growthPercent}
                    onChange={(e) => setGrowthPercent(e.currentTarget.value)}
                  />
                  <Button type="button" size="xs" onClick={applyGrowth}>
                    Apply to editable months
                  </Button>
                </div>
              </Popover.Dropdown>
            </Popover>
            <Button type="button" size="compact-sm" variant="default" onClick={copyAcrossSuggested}>
              Copy value across range
            </Button>
            <Button type="button" size="compact-sm" variant="default" onClick={confirmAllSuggested}>
              Confirm all suggested
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <IconCheck size={14} className="text-green-600" /> Confirmed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-orange-200 border border-orange-400" /> Needs review
            </span>
            <span className="text-gray-400">$0 Suggested</span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-gray-200 border border-gray-300" /> Past (actuals)
            </span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {fiscalYearChunks.map((fyChunk, fyIndex) => {
          const yearTotal = sumMonthlyValues(fyChunk.months);

          return (
            <div key={fyChunk.label} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">
                {fyChunk.label} <span className="font-normal text-gray-500">({yearRangeLabel(fyChunk.months)})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-gray-500 w-28 sticky left-0 bg-white">Cloud Spend</th>
                      {fyChunk.months.map((v) => (
                        <th key={monthKey(v.year, v.month)} className="px-2 py-2 text-center text-gray-500 font-medium">
                          {shortMonthLabel(v.year, v.month)}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center font-semibold bg-amber-50 text-gray-800">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 text-gray-600 sticky left-0 bg-white border-r border-gray-100">
                        Forecast
                      </td>
                      {fyChunk.months.map((v, i) => {
                        const globalIndex = fyChunk.startIndex + i;
                        const status = cellStatuses[globalIndex];
                        const cellClass =
                          status === 'past'
                            ? 'bg-gray-100'
                            : status === 'needsReview'
                              ? 'bg-orange-50 border border-orange-300'
                              : status === 'suggested'
                                ? 'bg-gray-50'
                                : 'bg-white';

                        return (
                          <td key={monthKey(v.year, v.month)} className={`px-1 py-1 ${cellClass} relative`}>
                            {status === 'needsReview' && (
                              <div className="flex items-center justify-center gap-0.5 text-[10px] font-bold text-orange-700 mb-0.5">
                                <IconPencil size={10} /> REVIEW
                              </div>
                            )}
                            {status === 'confirmed' && editable && (
                              <div className="flex justify-center mb-0.5">
                                <IconCheck size={14} className="text-green-600" />
                              </div>
                            )}
                            <CellEditor
                              value={v.amount}
                              currency={currency}
                              status={status}
                              editable={editable}
                              onChange={(amount) => updateAmount(globalIndex, amount)}
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-bold bg-amber-50 text-gray-900">
                        {formatForecastAmount(yearTotal, currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {fiscalYearChunks.map((fyChunk, fyIndex) => {
          const yearTotal = sumMonthlyValues(fyChunk.months);
          const prevYearTotal = activeFiscalTotals[fyIndex];
          const yoy = prevYearTotal > 0 ? ((yearTotal - prevYearTotal) / prevYearTotal) * 100 : null;

          return (
            <div key={fyChunk.label} className="rounded-lg border border-gray-200 p-4 bg-white">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fyChunk.label} total</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{formatForecastAmount(yearTotal, currency)}</div>
              {yoy != null ? (
                <div className={`text-sm mt-1 ${yoy > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {yoy > 0 ? '+' : ''}
                  {yoy.toFixed(1)}% vs. saved
                </div>
              ) : (
                <div className="text-sm text-gray-500 mt-1">No previous baseline</div>
              )}
            </div>
          );
        })}
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 sm:col-span-1">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {FISCAL_FORECAST_YEARS}-year fiscal total
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{formatForecastAmount(grandTotal, currency)}</div>
          <div className="text-xs text-gray-600 mt-1">{yearRangeLabel(values)}</div>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Saving creates a versioned snapshot used as the baseline for year-over-year comparison. Previous versions are
        retained in the forecast history.
      </p>

      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-600 space-y-0.5">
            {awaitingCount > 0 && <p className="font-medium text-gray-800">{awaitingCount} cells awaiting forecast</p>}
            {forecast.updatedAt && <p>Last saved {new Date(forecast.updatedAt).toLocaleString()}</p>}
            <p className="text-xs">
              Draft v{forecast.version} · {forecast.status.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="default" disabled={!isDirty} onClick={discardChanges}>
              Discard changes
            </Button>
            <Button
              type="button"
              color="primary"
              loading={save.isPending}
              disabled={!isDirty}
              onClick={() => save.mutate()}
            >
              Save forecast
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
