import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';
import { AlertSpendSummary, ProductAlertProps } from '@/emails/_components/public-cloud/AlertSpendSummary';

interface EmailProps extends ProductAlertProps {
  milestonePercent: number;
}

export default function ConsumptionMilestone({ productName, licencePlate, milestonePercent, ...spend }: EmailProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">Consumption milestone — {milestonePercent}% of forecast</Heading>
      <Text>Hi Product Team,</Text>
      <Text>
        Spend for <strong>{productName}</strong> ({licencePlate}) has reached <strong>{milestonePercent}%</strong> of
        the current monthly forecast.
      </Text>
      <Text>This is an early notice so you can review consumption before variance alerts (A1–A3) may apply.</Text>
      <AlertSpendSummary {...spend} />
      <Text>Review spend and update your forecast or add a note on the accountability page if needed.</Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>Review accountability</LinkButton>
    </PublicCloudLayout>
  );
}
