import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';

interface EmailProps {
  productName: string;
  licencePlate: string;
  version: number;
  rejectionReason: string;
}

export default function ForecastRejected({ productName, licencePlate, version, rejectionReason }: EmailProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">Forecast rejected — revision required</Heading>
      <Text>Hi Product Team,</Text>
      <Text>
        Forecast version {version} for <strong>{productName}</strong> ({licencePlate}) was rejected by a billing
        reviewer.
      </Text>
      <Text>
        <strong>Reviewer comments:</strong> {rejectionReason}
      </Text>
      <Text>Create a revised draft, address the feedback, and submit again for approval.</Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>Update forecast</LinkButton>
    </PublicCloudLayout>
  );
}
