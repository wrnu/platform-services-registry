import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';
import { AlertSpendSummary, ProductAlertProps } from '@/emails/_components/public-cloud/AlertSpendSummary';

export default function CostAlertA3Admin({ productName, licencePlate, ...spend }: ProductAlertProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">[Admin] A3 critical variance alert</Heading>
      <Text>
        <strong>{productName}</strong> ({licencePlate}) triggered an <strong>A3</strong> critical variance alert.
        Executive visibility is required.
      </Text>
      <AlertSpendSummary {...spend} />
      <Text>Review governance status and escalation requirements for this Project Set.</Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>View accountability</LinkButton>
      <LinkButton href="/public-cloud/accountability/compliance">Compliance list</LinkButton>
    </PublicCloudLayout>
  );
}
