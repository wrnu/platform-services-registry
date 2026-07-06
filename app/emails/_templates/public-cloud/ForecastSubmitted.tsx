import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';

interface EmailProps {
  productName: string;
  licencePlate: string;
  version: number;
  horizonMonths: number;
}

export default function ForecastSubmitted({ productName, licencePlate, version, horizonMonths }: EmailProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">Forecast submitted for approval</Heading>
      <Text>Hi Billing Reviewer,</Text>
      <Text>
        <strong>{productName}</strong> ({licencePlate}) submitted forecast version {version} for approval (
        {horizonMonths}-month horizon).
      </Text>
      <Text>Please review and approve or reject the forecast in the registry.</Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>Review forecast</LinkButton>
    </PublicCloudLayout>
  );
}
