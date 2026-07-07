'use client';

import { useQuery } from '@tanstack/react-query';
import LoadingBox from '@/components/generic/LoadingBox';
import {
  formatForecastAmount,
  formatPercentChange,
  getAdjacentFiscalYearPercentChange,
  getFiscalYearChunks,
  getProviderSpendLabel,
  isInProgressFiscalYear,
  isPastMonth,
  monthKey,
  shortMonthLabel,
  sumMonthlyValues,
  yearRangeLabel,
  type MonthlyValue,
} from '@/components/public-cloud/accountability/forecast-grid-utils';
import { GlobalPermissions } from '@/constants';
import createClientPage from '@/core/client-page';
import { getPlatformForecast } from '@/services/backend/public-cloud/accountability';
import { PlatformForecastSummary } from '@/services/db/public-cloud-accountability';

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

function PlatformForecastGrid({ group }: { group: PlatformForecastSummary['groups'][number] }) {
  const values = group.monthlyTotals as MonthlyValue[];
  const fiscalYearChunks = getFiscalYearChunks(values);
  const grandTotal = sumMonthlyValues(values);
  const spendLabel = group.providers.length === 1 ? getProviderSpendLabel(group.providers[0]) : 'Cloud Spend';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          {spendLabel} ({group.currency})
        </h2>
        <p className="text-sm text-gray-600">
          {group.forecastCount} of {group.productCount} {group.providers.join(' / ')} products have an approved forecast
          included in these totals.
        </p>
      </div>

      <div className="space-y-6">
        {fiscalYearChunks.map((fyChunk, chunkIndex) => {
          const yearTotal = sumMonthlyValues(fyChunk.months);
          const showYearTotal = !isInProgressFiscalYear(fyChunk);
          const yoy = getAdjacentFiscalYearPercentChange(fiscalYearChunks, chunkIndex);

          return (
            <div key={fyChunk.label} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span>
                  {fyChunk.label} <span className="font-normal text-gray-500">({yearRangeLabel(fyChunk.months)})</span>
                </span>
                {showYearTotal && yoy != null && (
                  <span className={`text-xs font-normal ${yoy > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatPercentChange(yoy)} vs prior fiscal year
                  </span>
                )}
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
                      <th
                        className={`px-3 py-2 text-center font-semibold ${
                          showYearTotal ? 'bg-amber-50 text-gray-800' : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        TOTAL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 text-gray-600 sticky left-0 bg-white border-r border-gray-100">
                        Forecast
                      </td>
                      {fyChunk.months.map((v) => (
                        <td
                          key={monthKey(v.year, v.month)}
                          className={`px-2 py-2 text-center ${
                            isPastMonth(v.year, v.month) ? 'bg-gray-100 text-gray-500' : 'bg-white text-gray-900'
                          }`}
                        >
                          {formatForecastAmount(v.amount, group.currency)}
                        </td>
                      ))}
                      {showYearTotal ? (
                        <td className="px-3 py-2 text-center font-bold bg-amber-50 text-gray-900">
                          {formatForecastAmount(yearTotal, group.currency)}
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

      <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 inline-block">
        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {values.length}-month platform total ({group.currency})
        </div>
        <div className="text-2xl font-bold text-gray-900 mt-1">{formatForecastAmount(grandTotal, group.currency)}</div>
        <div className="text-xs text-gray-600 mt-1">{yearRangeLabel(values)}</div>
      </div>
    </div>
  );
}

const platformForecastPage = createClientPage({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  fallbackUrl: '/login?callbackUrl=/home',
});

export default platformForecastPage(() => {
  const { data, isLoading } = useQuery<PlatformForecastSummary>({
    queryKey: ['accountability-platform-forecast'],
    queryFn: () => getPlatformForecast(),
  });

  const coverage =
    data && data.totalProducts > 0 ? Math.round((data.productsWithForecast / data.totalProducts) * 100) : 0;

  return (
    <LoadingBox isLoading={isLoading}>
      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-bold">Platform forecast</h1>
          <p className="text-sm text-gray-600 mt-1">
            Read-only rollup of the latest approved forecast for every active public cloud product. AWS forecasts are in
            USD and Azure forecasts in CAD, so totals are reported per currency.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Active projects" value={String(data?.totalProducts ?? 0)} />
          <SummaryCard label="With approved forecast" value={String(data?.productsWithForecast ?? 0)} />
          <SummaryCard
            label="Forecast coverage"
            value={`${coverage}%`}
            hint="Products missing an approved forecast are not included in the totals below."
          />
        </div>

        {data?.groups.length ? (
          <div className="space-y-10">
            {data.groups.map((group) => (
              <PlatformForecastGrid key={group.currency} group={group} />
            ))}
          </div>
        ) : (
          !isLoading && <p className="text-sm text-gray-600">No active public cloud products found.</p>
        )}
      </div>
    </LoadingBox>
  );
});
