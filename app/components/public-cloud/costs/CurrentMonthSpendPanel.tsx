import { Table } from '@mantine/core';
import { monthNames } from '@/constants/common';
import { CloudSpendSnapshot } from '@/prisma/client';
import { formatCurrency } from '@/utils/js';

function formatBillingPeriod(year: number, month: number) {
  return `${monthNames[month - 1]} ${year}`;
}

export default function CurrentMonthSpendPanel({
  snapshot,
  billingPeriod,
  title = 'Current month spend',
  showTitle = true,
  showTotalHighlight = false,
}: {
  snapshot: CloudSpendSnapshot | null;
  billingPeriod?: { year: number; month: number };
  title?: string;
  showTitle?: boolean;
  showTotalHighlight?: boolean;
}) {
  const currency = snapshot?.currency ?? 'USD';
  const periodLabel = billingPeriod ? formatBillingPeriod(billingPeriod.year, billingPeriod.month) : null;

  if (!snapshot) {
    return (
      <div>
        {showTitle && <h3 className="font-bold text-xl mb-2">{title}</h3>}
        <p className="text-gray-600">No consumption data received from CSP yet.</p>
      </div>
    );
  }

  return (
    <div>
      {showTitle && <h3 className="font-bold text-xl mb-2">{title}</h3>}
      {periodLabel && (
        <p className="text-sm text-gray-600 mb-3">
          Billing period: <strong>{periodLabel}</strong>
        </p>
      )}
      {showTotalHighlight && (
        <div className="mb-4 inline-flex py-3 px-5 bg-zinc-100 border border-gray-300 rounded-md">
          <strong>Total spend to date:&nbsp;</strong>
          {formatCurrency(snapshot.amountToDate, { currency })}
        </div>
      )}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <div>
            <strong>Forecast:</strong> {formatCurrency(snapshot.forecastAmount, { currency })}
          </div>
          <div>
            <strong>Spend to date:</strong> {formatCurrency(snapshot.amountToDate, { currency })}
          </div>
          <div>
            <strong>Projected month-end:</strong> {formatCurrency(snapshot.projectedMonthEnd, { currency })}
          </div>
          <div>
            <strong>Variance:</strong> {formatCurrency(snapshot.varianceAmount, { currency })} (
            {snapshot.variancePercent.toFixed(1)}
            %)
          </div>
          <div>
            <strong>Consumption:</strong> {snapshot.consumptionPercent.toFixed(1)}% of forecast
          </div>
          <div>
            <strong>Data as of:</strong> {new Date(snapshot.asOfDate).toLocaleString()}
          </div>
        </div>
        {snapshot.accounts?.length > 0 && (
          <Table striped className="max-w-xl">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Account</Table.Th>
                <Table.Th>Environment</Table.Th>
                <Table.Th>Spend</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {snapshot.accounts.map((account) => (
                <Table.Tr key={account.accountId}>
                  <Table.Td>{account.accountId}</Table.Td>
                  <Table.Td>{account.environment ?? '—'}</Table.Td>
                  <Table.Td>{formatCurrency(account.spendToDate, { currency })}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
