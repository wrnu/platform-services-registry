'use client';

import { useQuery } from '@tanstack/react-query';
import Table from '@/components/generic/table/Table';
import { GlobalPermissions } from '@/constants';
import createClientPage from '@/core/client-page';
import { searchPublicCloudAccountability } from '@/services/backend/public-cloud/accountability';
import { PublicCloudAccountabilitySearchRow } from '@/services/db/public-cloud-accountability';
import TableBody from '../all/TableBody';

const compliancePage = createClientPage({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  fallbackUrl: '/login?callbackUrl=/home',
});

export default compliancePage(() => {
  const { data, isLoading } = useQuery({
    queryKey: ['accountability-compliance'],
    queryFn: () =>
      searchPublicCloudAccountability({
        onEscalationList: true,
        page: 1,
        pageSize: 100,
      }),
  });

  const rows: PublicCloudAccountabilitySearchRow[] = data?.data ?? [];

  return (
    <Table
      title="Accountability compliance & escalation"
      totalCount={rows.length}
      page={1}
      pageSize={rows.length || 10}
      isLoading={isLoading}
    >
      <TableBody data={rows} />
    </Table>
  );
});
