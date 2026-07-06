import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';
import { AlertSpendSummary, ProductAlertProps } from '@/emails/_components/public-cloud/AlertSpendSummary';

export default function CostAlertA2Admin({ productName, licencePlate, ...spend }: ProductAlertProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">[Admin] A2 variance alert</Heading>
      <Text>
        <strong>{productName}</strong> ({licencePlate}) triggered an <strong>A2</strong> variance alert (significant
        overrun vs forecast).
      </Text>
      <AlertSpendSummary {...spend} />
      <Text>Review accountability status and follow up with the product team if needed.</Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>View accountability</LinkButton>
      <LinkButton href="/public-cloud/accountability/compliance">Compliance list</LinkButton>
    </PublicCloudLayout>
  );
}
