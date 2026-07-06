import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';
import { AlertSpendSummary, ProductAlertProps } from '@/emails/_components/public-cloud/AlertSpendSummary';

export default function CostAlertA1Admin({ productName, licencePlate, ...spend }: ProductAlertProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">[Admin] A1 variance alert</Heading>
      <Text>
        <strong>{productName}</strong> ({licencePlate}) triggered an <strong>A1</strong> variance alert (projected spend
        more than 10% above forecast).
      </Text>
      <AlertSpendSummary {...spend} />
      <Text>The product team has been notified to review spend and update the forecast if needed.</Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>View accountability</LinkButton>
      <LinkButton href="/public-cloud/accountability/compliance">Compliance list</LinkButton>
    </PublicCloudLayout>
  );
}
