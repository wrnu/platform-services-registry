'use client';

import { useQuery } from '@tanstack/react-query';
import Table from '@/components/generic/table/Table';
import { GlobalPermissions } from '@/constants';
import createClientPage from '@/core/client-page';
import { AccountabilityStatus } from '@/prisma/client';
import { searchPublicCloudAccountability } from '@/services/backend/public-cloud/accountability';
import { PublicCloudAccountabilitySearchRow } from '@/services/db/public-cloud-accountability';
import TableBody from '../all/TableBody';

const directorStatuses = [
  AccountabilityStatus.ESCALATED,
  AccountabilityStatus.FORECAST_REVIEW_REQUIRED,
  AccountabilityStatus.VARIANCE_REVIEW_REQUIRED,
  AccountabilityStatus.FORECAST_REQUIRED,
];

const directorPage = createClientPage({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  fallbackUrl: '/login?callbackUrl=/home',
});

export default directorPage(() => {
  const { data, isLoading } = useQuery({
    queryKey: ['accountability-director'],
    queryFn: () =>
      searchPublicCloudAccountability({
        statuses: directorStatuses,
        page: 1,
        pageSize: 500,
      }),
  });

  const rows: PublicCloudAccountabilitySearchRow[] = data?.data ?? [];

  return (
    <Table
      title="Director accountability view"
      description="Projects requiring forecast, quarterly, or variance action."
      totalCount={rows.length}
      page={1}
      pageSize={rows.length || 10}
      isLoading={isLoading}
    >
      <TableBody data={rows} />
    </Table>
  );
});
