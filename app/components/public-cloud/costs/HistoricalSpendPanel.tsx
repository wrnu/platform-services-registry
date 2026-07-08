'use client';

import { Table } from '@mantine/core';
import { formatCurrency } from '@/utils/js';

type ClosedMonth = {
  year: number;
  month: number;
  currency: string;
  actualTotal: number;
  forecastTotal?: number | null;
  varianceAmount?: number | null;
  variancePercent?: number | null;
};

export default function HistoricalSpendPanel({
  months,
  provider,
  title = 'Historical spend',
  showInceptionSummary = false,
}: {
  months: ClosedMonth[];
  provider?: string;
  title?: string;
  showInceptionSummary?: boolean;
}) {
  if (!months.length) {
    return (
      <div>
        <h3 className="font-bold text-xl mb-2">{title}</h3>
        <p className="text-gray-600">No closed-month spend history from CSP yet.</p>
      </div>
    );
  }

  const sortedMonths = [...months].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));
  const currency = sortedMonths[0]?.currency ?? 'USD';
  const totalActual = sortedMonths.reduce((sum, m) => sum + m.actualTotal, 0);
  const totalForecast = sortedMonths.reduce((sum, m) => sum + (m.forecastTotal ?? 0), 0);
  const firstMonth = sortedMonths[0];
  const lastMonth = sortedMonths[sortedMonths.length - 1];

  return (
    <div>
      <h3 className="font-bold text-xl mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">
        {showInceptionSummary
          ? `Closed-month actuals from ${provider ?? 'CSP'} (${firstMonth.year}-${String(firstMonth.month).padStart(
              2,
              '0',
            )} through ${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}).`
          : `Closed-month actuals from ${
              provider ?? 'CSP'
            } since project inception. Current-month spend is on the Costs tab.`}
      </p>
      <div className="mb-4 inline-flex py-3 px-5 bg-zinc-100 border border-gray-300 rounded-md text-sm">
        <strong>Total actual:&nbsp;</strong>
        {formatCurrency(totalActual, { currency })}
        {totalForecast > 0 && (
          <>
            {' '}
            · <strong>Total forecast:&nbsp;</strong>
            {formatCurrency(totalForecast, { currency })}
          </>
        )}
      </div>
      <Table striped className="max-w-3xl">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Month</Table.Th>
            <Table.Th>Actual</Table.Th>
            <Table.Th>Forecast</Table.Th>
            <Table.Th>Variance</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sortedMonths.map((m) => (
            <Table.Tr key={`${m.year}-${m.month}`}>
              <Table.Td>
                {m.year}-{String(m.month).padStart(2, '0')}
              </Table.Td>
              <Table.Td>{formatCurrency(m.actualTotal, { currency: m.currency })}</Table.Td>
              <Table.Td>
                {m.forecastTotal != null ? formatCurrency(m.forecastTotal, { currency: m.currency }) : '—'}
              </Table.Td>
              <Table.Td>{m.variancePercent != null ? `${m.variancePercent.toFixed(1)}%` : '—'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}
