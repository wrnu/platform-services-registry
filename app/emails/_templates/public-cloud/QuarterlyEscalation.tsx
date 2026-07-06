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

export default function QuarterlyEscalation({ productName, licencePlate, quarter, fiscalYear }: EmailProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">
        M+1 escalation — Q{quarter} {fiscalYear}
      </Heading>
      <Text>
        Quarterly accountability for <strong>{productName}</strong> ({licencePlate}) was not completed by the M+1
        deadline (one month after quarter start).
      </Text>
      <Text>
        The project has been placed on the escalation list. Please review outstanding forecast updates, quarterly
        checklist items, and PO sign-off status.
      </Text>
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>View accountability page</LinkButton>
      <LinkButton href="/public-cloud/accountability/compliance">Open compliance list</LinkButton>
    </PublicCloudLayout>
  );
}
