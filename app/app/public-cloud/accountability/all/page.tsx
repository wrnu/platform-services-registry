'use client';

import { SegmentedControl } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useSnapshot } from 'valtio/react';
import Table from '@/components/generic/table/Table';
import { GlobalPermissions } from '@/constants';
import { AccountabilityPreset, accountabilityPresetOptions, accountabilitySorts } from '@/constants/accountability';
import createClientPage from '@/core/client-page';
import {
  searchPublicCloudAccountability,
  downloadBundledAccountabilityExport,
} from '@/services/backend/public-cloud/accountability';
import {
  PublicCloudAccountabilitySearchRow,
  PublicCloudAccountabilitySearchSummary,
} from '@/services/db/public-cloud-accountability';
import FilterPanel from './FilterPanel';
import { applyPreset, pageState } from './state';
import TableBody from './TableBody';

const presetValues = accountabilityPresetOptions.map((option) => option.value);

function SummaryCard({ label, value, className = '' }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${className}`}>{value}</div>
    </div>
  );
}

const accountabilityPage = createClientPage({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  fallbackUrl: '/login?callbackUrl=/home',
});

export default accountabilityPage(() => {
  const snap = useSnapshot(pageState);
  const searchParams = useSearchParams();

  // Retired director/executive/compliance routes redirect here with ?preset=.
  useEffect(() => {
    const preset = searchParams.get('preset') as AccountabilityPreset | null;
    if (preset && presetValues.includes(preset) && preset !== pageState.preset) {
      applyPreset(preset);
    }
  }, [searchParams]);

  let totalCount = 0;
  let rows: PublicCloudAccountabilitySearchRow[] = [];
  let summary: PublicCloudAccountabilitySearchSummary | undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['accountability-all', snap],
    queryFn: () => {
      const { preset, ...searchBody } = snap;
      return searchPublicCloudAccountability(searchBody);
    },
  });

  if (!isLoading && data) {
    rows = data.data;
    totalCount = data.totalCount;
    summary = data.summary;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Active projects" value={summary?.totalProjects ?? 0} />
        <SummaryCard label="Needing action" value={summary?.needingAction ?? 0} className="text-red-600" />
        <SummaryCard label="Escalated" value={summary?.escalated ?? 0} className="text-orange-600" />
        <SummaryCard label="Open alerts" value={summary?.openAlerts ?? 0} className="text-orange-600" />
      </div>

      <SegmentedControl
        value={snap.preset}
        onChange={(value) => applyPreset(value as AccountabilityPreset)}
        data={accountabilityPresetOptions}
      />

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
        onExport={async () => downloadBundledAccountabilityExport(snap.provider)}
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
    </div>
  );
});
