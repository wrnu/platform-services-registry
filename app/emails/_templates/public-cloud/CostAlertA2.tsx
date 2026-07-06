import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';
import { AlertSpendSummary, ProductAlertProps } from '@/emails/_components/public-cloud/AlertSpendSummary';

export default function CostAlertA2({ productName, licencePlate, ...spend }: ProductAlertProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">A2 variance alert — significant overrun</Heading>
      <Text>Hi Product Team,</Text>
      <Text>
        Projected spend for <strong>{productName}</strong> ({licencePlate}) exceeds the <strong>A2</strong> threshold
        (more than 50% above forecast or more than $500 above forecast).
      </Text>
      <AlertSpendSummary {...spend} />
      <Text>
        Acknowledge this alert and provide an explanation or corrective plan on the accountability page. Platform admins
        have been notified.
      </Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>Respond on accountability page</LinkButton>
    </PublicCloudLayout>
  );
}
