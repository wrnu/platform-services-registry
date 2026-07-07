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

export default function EscalationListSummary({ rows, periodLabel }: EmailProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">Escalation list — {periodLabel}</Heading>
      <Text>
        The following public cloud projects are on the accountability escalation list and require immediate attention:
      </Text>
      {rows.length === 0 ? (
        <Text>No projects are currently on the escalation list.</Text>
      ) : (
        rows.map((row) => (
          <Text key={row.licencePlate}>
            {row.name} ({row.licencePlate}): {row.status.replace(/_/g, ' ')}
            {row.highestOpenAlert ? ` — open ${row.highestOpenAlert}` : ''}
          </Text>
        ))
      )}
      <LinkButton href="/public-cloud/accountability/compliance">Open escalation list</LinkButton>
    </PublicCloudLayout>
  );
}
