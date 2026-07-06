import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';

interface EmailProps {
  productName: string;
  licencePlate: string;
  quarter: number;
  fiscalYear: number;
}

export default function QuarterlyForecastReminder({ productName, licencePlate, quarter, fiscalYear }: EmailProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">
        Quarterly forecast update — Q{quarter} {fiscalYear}
      </Heading>
      <Text>Hi Product Team,</Text>
      <Text>
        It is time to update the fiscal year cloud spend forecast for <strong>{productName}</strong> ({licencePlate}).
      </Text>
      <Text>
        Please extend months 21–24, review the prior 21 months, update team members, review past three months of spend,
        complete the soft quarterly review, and obtain PO sign-off.
      </Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>Open accountability page</LinkButton>
    </PublicCloudLayout>
  );
}
