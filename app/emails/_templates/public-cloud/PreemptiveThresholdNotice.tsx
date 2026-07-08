import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';
import { AlertSpendSummary, ProductAlertProps } from '@/emails/_components/public-cloud/AlertSpendSummary';

interface EmailProps extends ProductAlertProps {
  preemptiveDayOfMonth?: number;
  preemptivePercent?: number;
}

export default function PreemptiveThresholdNotice({
  productName,
  licencePlate,
  preemptiveDayOfMonth,
  preemptivePercent,
  ...spend
}: EmailProps) {
  const thresholdLabel =
    preemptivePercent != null && preemptiveDayOfMonth != null
      ? `${preemptivePercent}% of forecast by day ${preemptiveDayOfMonth}`
      : 'the configured pre-emptive threshold';

  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">Pre-emptive spend notice (A0) — {productName}</Heading>
      <Text>Hi Product Team,</Text>
      <Text>
        Consumption for <strong>{productName}</strong> ({licencePlate}) has reached {thresholdLabel}. This is an early
        notice before a formal pace warning is issued.
      </Text>
      <Text>Review usage and your forecast now to avoid escalation later in the month.</Text>
      <AlertSpendSummary {...spend} />
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>Review accountability</LinkButton>
    </PublicCloudLayout>
  );
}
