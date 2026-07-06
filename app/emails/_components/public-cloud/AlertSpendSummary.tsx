import { Text } from '@react-email/components';
import * as React from 'react';

export interface AlertSpendProps {
  spendToDate: number;
  forecastAmount: number;
  projectedMonthEnd: number;
  varianceAmount: number;
  variancePercent: number;
  consumptionPercentOfForecast: number;
  currency: string;
}

export function AlertSpendSummary({
  spendToDate,
  forecastAmount,
  projectedMonthEnd,
  varianceAmount,
  variancePercent,
  consumptionPercentOfForecast,
  currency,
}: AlertSpendProps) {
  return (
    <>
      <Text>
        <strong>Spend to date:</strong> {spendToDate.toFixed(2)} {currency}
      </Text>
      <Text>
        <strong>Monthly forecast:</strong> {forecastAmount.toFixed(2)} {currency}
      </Text>
      <Text>
        <strong>Projected month-end:</strong> {projectedMonthEnd.toFixed(2)} {currency}
      </Text>
      <Text>
        <strong>Consumption:</strong> {consumptionPercentOfForecast.toFixed(1)}% of forecast
      </Text>
      <Text>
        <strong>Variance:</strong> {varianceAmount.toFixed(2)} {currency} ({variancePercent.toFixed(1)}%)
      </Text>
    </>
  );
}

export interface ProductAlertProps extends AlertSpendProps {
  productName: string;
  licencePlate: string;
}
