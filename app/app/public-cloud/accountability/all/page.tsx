'use client';

import { useQuery } from '@tanstack/react-query';
import { useSnapshot } from 'valtio/react';
import Table from '@/components/generic/table/Table';
import { GlobalPermissions } from '@/constants';
import { accountabilitySorts } from '@/constants/accountability';
import createClientPage from '@/core/client-page';
import { searchPublicCloudAccountability } from '@/services/backend/public-cloud/accountability';
import { PublicCloudAccountabilitySearchRow } from '@/services/db/public-cloud-accountability';
import FilterPanel from './FilterPanel';
import { pageState } from './state';
import TableBody from './TableBody';

const accountabilityPage = createClientPage({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  fallbackUrl: 'login?callbackUrl=/home',
});

export default accountabilityPage(() => {
  const snap = useSnapshot(pageState);
  let totalCount = 0;
  let rows: PublicCloudAccountabilitySearchRow[] = [];

  const { data, isLoading } = useQuery({
    queryKey: ['accountability-all', snap],
    queryFn: () => searchPublicCloudAccountability(snap),
  });

  if (!isLoading && data) {
    rows = data.data;
    totalCount = data.totalCount;
  }

  return (
    <Table
      title="Public Cloud Accountability"
      totalCount={totalCount}
      page={snap.page ?? 1}
      pageSize={snap.pageSize ?? 10}
      sortKey={snap.sortValue}
      onPagination={(page: number, pageSize: number) => {
        pageState.page = page;
        pageState.pageSize = pageSize;
      }}
      onSearch={(searchTerm: string) => {
        pageState.page = 1;
        pageState.search = searchTerm;
      }}
      onSort={(sortValue) => {
        pageState.page = 1;
        pageState.sortValue = sortValue;
      }}
      sortOptions={accountabilitySorts.map((val) => val.label)}
      filters={<FilterPanel />}
      isLoading={isLoading}
    >
      <TableBody data={rows} />
    </Table>
  );
});
