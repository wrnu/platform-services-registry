import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';

interface RecapRow {
  licencePlate: string;
  name: string;
  status: string;
  highestOpenAlert?: string | null;
  onEscalationList: boolean;
}

interface EmailProps {
  rows: RecapRow[];
  periodLabel: string;
}

export default function MonthlyAccountabilityRecap({ rows, periodLabel }: EmailProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">Monthly accountability recap — {periodLabel}</Heading>
      <Text>Summary of Public Cloud Project Set accountability status.</Text>
      {rows.length === 0 ? (
        <Text>No active public cloud products found.</Text>
      ) : (
        rows.map((row) => (
          <Text key={row.licencePlate}>
            {row.name} ({row.licencePlate}): {row.status.replace(/_/g, ' ')}
            {row.highestOpenAlert ? ` — open ${row.highestOpenAlert}` : ''}
            {row.onEscalationList ? ' — escalated' : ''}
          </Text>
        ))
      )}
      <LinkButton href="/public-cloud/accountability/all">Open governance dashboard</LinkButton>
    </PublicCloudLayout>
  );
}
