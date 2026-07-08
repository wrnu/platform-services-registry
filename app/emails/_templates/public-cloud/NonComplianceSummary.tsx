import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';

type Row = {
  licencePlate: string;
  name: string;
  status: string;
  highestOpenAlert?: string | null;
};

interface EmailProps {
  rows: Row[];
  periodLabel: string;
}

export default function NonComplianceSummary({ rows, periodLabel }: EmailProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">Projects out of compliance — {periodLabel}</Heading>
      <Text>The following active public cloud projects require accountability action:</Text>
      {rows.length === 0 ? (
        <Text>All projects are currently compliant.</Text>
      ) : (
        rows.map((row) => (
          <Text key={row.licencePlate}>
            {row.name} ({row.licencePlate}): {row.status.replace(/_/g, ' ')}
            {row.highestOpenAlert ? ` — open ${row.highestOpenAlert}` : ''}
          </Text>
        ))
      )}
      <LinkButton href="/public-cloud/accountability/all">Open governance dashboard</LinkButton>
    </PublicCloudLayout>
  );
}
