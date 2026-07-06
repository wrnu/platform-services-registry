'use client';

import { Alert, Button, Modal, NumberInput, Popover, Radio, TextInput, Textarea } from '@mantine/core';
import { IconCheck, IconPencil } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { updatePublicCloudForecast } from '@/services/backend/public-cloud/accountability';
import {
  applyAmountToFutureMonths,
  applyPercentGrowthToEditableMonths,
  copyAmountAcrossEditableMonths,
  countCellsAwaitingForecast,
  FISCAL_FORECAST_HORIZON_MONTHS,
  FISCAL_FORECAST_YEARS,
  formatForecastAmount,
  formatPercentChange,
  getAdjacentFiscalYearPercentChange,
  getCellStatuses,
  getFiscalYearChunks,
  getForecastIncreases,
  getInitialConfirmedKeys,
  getProviderSpendLabel,
  getReviewWindowStartIndex,
  isInProgressFiscalYear,
  isPastMonth,
  mergeMonthlyValuesOntoFiscalHorizon,
  monthKey,
  preserveLockedPastMonthlyValues,
  shortMonthLabel,
  sumMonthlyValues,
  yearRangeLabel,
  type ForecastCellStatus,
  type ForecastIncrease,
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
  onApplyToFuture,
}: {
  value: number;
  currency: string;
  status: ForecastCellStatus;
  editable: boolean;
  onChange: (amount: number) => void;
  onApplyToFuture?: () => void;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const [showApplyFuture, setShowApplyFuture] = useState(false);

  useEffect(() => {
    setDraftValue(value);
    setShowApplyFuture(false);
  }, [value]);

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
      <div className="space-y-1">
        <NumberInput
          value={draftValue}
          min={0}
          hideControls
          thousandSeparator=","
          prefix={currency === 'USD' ? '$' : '$'}
          onChange={(val) => {
            const next = typeof val === 'number' ? val : 0;
            setDraftValue(next);
            onChange(next);
            setShowApplyFuture(next !== value);
          }}
          classNames={{ input: 'text-center font-medium text-sm h-9' }}
          size="sm"
        />
        {showApplyFuture && onApplyToFuture && (
          <button
            type="button"
            className="text-[10px] text-blue-700 underline"
            onClick={() => {
              onApplyToFuture();
              setShowApplyFuture(false);
            }}
          >
            Apply to all future months
          </button>
        )}
      </div>
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
  provider,
  onSaved,
}: {
  licencePlate: string;
  forecast: ForecastMeta;
  monthlyValues: MonthlyValue[];
  activeBaseline: MonthlyValue[] | null;
  quarterlyReview: QuarterlyReview | null;
  editable: boolean;
  provider?: string;
  onSaved: () => void;
}) {
  const currency = monthlyValues[0]?.currency ?? 'CAD';
  const spendLabel = getProviderSpendLabel(provider);

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
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [pendingIncreases, setPendingIncreases] = useState<ForecastIncrease[]>([]);
  const [changeJustification, setChangeJustification] = useState('');
  const [changeNature, setChangeNature] = useState<'ONE_TIME' | 'ONGOING'>('ONE_TIME');

  const comparisonBaseline = baselineActive ?? baselineValues;

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
  const savedGrandTotal = sumMonthlyValues(comparisonBaseline);
  const grandTotalChange = savedGrandTotal > 0 ? ((grandTotal - savedGrandTotal) / savedGrandTotal) * 100 : null;

  const reviewStart = getReviewWindowStartIndex(values);
  const quarterKeys = new Set(
    values.filter((_, i) => cellStatuses[i] === 'needsReview').map((v) => monthKey(v.year, v.month)),
  );
  const reviewMonthLabels = values
    .filter((v) => quarterKeys.has(monthKey(v.year, v.month)))
    .map((v) => shortMonthLabel(v.year, v.month));

  const performSave = (justification?: string, nature?: 'ONE_TIME' | 'ONGOING') => {
    const lockedValues = preserveLockedPastMonthlyValues(baselineValues, values);
    return updatePublicCloudForecast(licencePlate, forecast.id, {
      monthlyValues: lockedValues.map((v) => ({
        year: v.year,
        month: v.month,
        amount: Number(v.amount),
        currency: v.currency as 'USD' | 'CAD',
      })),
      horizonMonths: FISCAL_FORECAST_HORIZON_MONTHS,
      ...(justification
        ? {
            changeJustification: justification,
            changeNature: nature,
          }
        : {}),
    });
  };

  const save = useMutation({
    mutationFn: ({ justification, nature }: { justification?: string; nature?: 'ONE_TIME' | 'ONGOING' } = {}) =>
      performSave(justification, nature),
    onSuccess: () => {
      setSaveModalOpen(false);
      setChangeJustification('');
      setChangeNature('ONE_TIME');
      setPendingIncreases([]);
      onSaved();
    },
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

  const handleSaveClick = () => {
    const lockedValues = preserveLockedPastMonthlyValues(baselineValues, values);
    const increases = getForecastIncreases(lockedValues, comparisonBaseline);
    if (increases.length > 0) {
      setPendingIncreases(increases);
      setSaveModalOpen(true);
      return;
    }
    save.mutate({});
  };

  const applyToFutureMonths = (index: number, amount: number) => {
    setValues((prev) => {
      const statuses = getCellStatuses(prev, cellStatusOptions);
      return applyAmountToFutureMonths(prev, statuses, index, amount);
    });
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
          Rolling {FISCAL_FORECAST_HORIZON_MONTHS}-month forecast ({yearRangeLabel(values)}).
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
        {fiscalYearChunks.map((fyChunk) => {
          const yearTotal = sumMonthlyValues(fyChunk.months);
          const showYearTotal = !isInProgressFiscalYear(fyChunk);

          return (
            <div key={fyChunk.label} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">
                {fyChunk.label} <span className="font-normal text-gray-500">({yearRangeLabel(fyChunk.months)})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-gray-500 w-28 sticky left-0 bg-white">{spendLabel}</th>
                      {fyChunk.months.map((v) => (
                        <th key={monthKey(v.year, v.month)} className="px-2 py-2 text-center text-gray-500 font-medium">
                          {shortMonthLabel(v.year, v.month)}
                        </th>
                      ))}
                      {showYearTotal ? (
                        <th className="px-3 py-2 text-center font-semibold bg-amber-50 text-gray-800">TOTAL</th>
                      ) : (
                        <th className="px-3 py-2 text-center font-semibold bg-gray-50 text-gray-400">TOTAL</th>
                      )}
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
                              onApplyToFuture={() => applyToFutureMonths(globalIndex, values[globalIndex]?.amount ?? 0)}
                            />
                          </td>
                        );
                      })}
                      {showYearTotal ? (
                        <td className="px-3 py-2 text-center font-bold bg-amber-50 text-gray-900">
                          {formatForecastAmount(yearTotal, currency)}
                        </td>
                      ) : (
                        <td className="px-3 py-2 text-center text-sm bg-gray-50 text-gray-400">In progress</td>
                      )}
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
          const showYearTotal = !isInProgressFiscalYear(fyChunk);
          const yoy = getAdjacentFiscalYearPercentChange(fiscalYearChunks, fyIndex);

          if (!showYearTotal) {
            return (
              <div key={fyChunk.label} className="rounded-lg border border-dashed border-gray-300 p-4 bg-gray-50">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fyChunk.label} total</div>
                <div className="text-sm text-gray-600 mt-2">
                  Annual total hidden while this fiscal year is in progress.
                </div>
              </div>
            );
          }

          return (
            <div key={fyChunk.label} className="rounded-lg border border-gray-200 p-4 bg-white">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fyChunk.label} total</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{formatForecastAmount(yearTotal, currency)}</div>
              {yoy != null ? (
                <div className={`text-sm mt-1 ${yoy > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatPercentChange(yoy)} vs prior fiscal year
                </div>
              ) : (
                <div className="text-sm text-gray-500 mt-1">First fiscal year in forecast</div>
              )}
            </div>
          );
        })}
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 sm:col-span-1">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {FISCAL_FORECAST_HORIZON_MONTHS}-month forecast total
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{formatForecastAmount(grandTotal, currency)}</div>
          {grandTotalChange != null ? (
            <div className={`text-sm mt-1 ${grandTotalChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatPercentChange(grandTotalChange)} vs last saved forecast
            </div>
          ) : (
            <div className="text-xs text-gray-600 mt-1">{yearRangeLabel(values)}</div>
          )}
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
              onClick={handleSaveClick}
            >
              Save forecast
            </Button>
          </div>
        </div>
      )}

      <Modal opened={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="Explain forecast increases" centered>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            One or more forecast months increased compared to the last saved forecast. Provide a short justification
            before saving.
          </p>
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            {pendingIncreases.map((increase) => (
              <li key={monthKey(increase.year, increase.month)}>
                {shortMonthLabel(increase.year, increase.month)}:{' '}
                {formatForecastAmount(increase.previousAmount, currency)} →{' '}
                {formatForecastAmount(increase.newAmount, currency)}
              </li>
            ))}
          </ul>
          <Textarea
            label="Justification"
            required
            minRows={3}
            value={changeJustification}
            onChange={(event) => setChangeJustification(event.currentTarget.value)}
            placeholder="Explain why the forecast increased..."
          />
          <Radio.Group
            label="Nature of change"
            value={changeNature}
            onChange={(value) => setChangeNature(value as 'ONE_TIME' | 'ONGOING')}
          >
            <div className="space-y-2 mt-2">
              <Radio value="ONE_TIME" label="One-time change" />
              <Radio value="ONGOING" label="Ongoing change" />
            </div>
          </Radio.Group>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="default" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              color="primary"
              loading={save.isPending}
              disabled={!changeJustification.trim()}
              onClick={() => save.mutate({ justification: changeJustification.trim(), nature: changeNature })}
            >
              Save forecast
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
