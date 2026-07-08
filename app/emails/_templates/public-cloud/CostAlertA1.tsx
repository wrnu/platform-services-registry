import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';
import { AlertSpendSummary, ProductAlertProps } from '@/emails/_components/public-cloud/AlertSpendSummary';

export default function CostAlertA1({ productName, licencePlate, ...spend }: ProductAlertProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">A1 variance alert — review forecast</Heading>
      <Text>Hi Product Team,</Text>
      <Text>
        Projected spend for <strong>{productName}</strong> ({licencePlate}) is more than <strong>10%</strong> above the
        monthly forecast (A1 threshold).
      </Text>
      <AlertSpendSummary {...spend} />
      <Text>
        Please review spend, update your forecast if appropriate, and acknowledge the alert on the accountability page.
      </Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>Respond on accountability page</LinkButton>
    </PublicCloudLayout>
  );
}
