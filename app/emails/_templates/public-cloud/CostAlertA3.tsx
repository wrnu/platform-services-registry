import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';
import { AlertSpendSummary, ProductAlertProps } from '@/emails/_components/public-cloud/AlertSpendSummary';

export default function CostAlertA3({ productName, licencePlate, ...spend }: ProductAlertProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">A3 variance alert — critical overrun</Heading>
      <Text>Hi Product Team,</Text>
      <Text>
        Projected spend for <strong>{productName}</strong> ({licencePlate}) exceeds the <strong>A3</strong> critical
        threshold. Immediate review and corrective action are required.
      </Text>
      <AlertSpendSummary {...spend} />
      <Text>
        Acknowledge and resolve this alert with a detailed explanation. Executive stakeholders have been notified.
      </Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>Respond on accountability page</LinkButton>
    </PublicCloudLayout>
  );
}
