import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';
import { AlertSpendSummary, ProductAlertProps } from '@/emails/_components/public-cloud/AlertSpendSummary';

interface EmailProps extends ProductAlertProps {
  paceDayOfMonth?: number;
}

export default function ConsumptionPaceWarning({ productName, licencePlate, paceDayOfMonth, ...spend }: EmailProps) {
  const dayLabel = paceDayOfMonth ? `day ${paceDayOfMonth} of the month` : 'the configured pace threshold';

  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">Early pace warning — {productName}</Heading>
      <Text>Hi Product Team,</Text>
      <Text>
        Consumption for <strong>{productName}</strong> ({licencePlate}) is ahead of expected pace by {dayLabel}.
      </Text>
      <Text>
        Spend is high relative to the calendar month. Review usage now to avoid formal variance alerts later in the
        month.
      </Text>
      <AlertSpendSummary {...spend} />
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>Review accountability</LinkButton>
    </PublicCloudLayout>
  );
}
