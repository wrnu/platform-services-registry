'use client';

import { useQuery } from '@tanstack/react-query';
import Table from '@/components/generic/table/Table';
import { GlobalPermissions } from '@/constants';
import createClientPage from '@/core/client-page';
import { AccountabilityStatus } from '@/prisma/client';
import { searchPublicCloudAccountability } from '@/services/backend/public-cloud/accountability';
import { PublicCloudAccountabilitySearchRow } from '@/services/db/public-cloud-accountability';
import TableBody from '../all/TableBody';

const executivePage = createClientPage({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  fallbackUrl: 'login?callbackUrl=/home',
});

export default executivePage(() => {
  const { data, isLoading } = useQuery({
    queryKey: ['accountability-executive'],
    queryFn: () =>
      searchPublicCloudAccountability({
        page: 1,
        pageSize: 500,
      }),
  });

  const rows: PublicCloudAccountabilitySearchRow[] = data?.data ?? [];
  const nonCompliant = rows.filter((row) => row.status !== AccountabilityStatus.COMPLIANT);
  const escalated = rows.filter((row) => row.onEscalationList);
  const openAlerts = rows.filter((row) => row.highestOpenAlert);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4 bg-white">
          <div className="text-sm text-gray-500">Active projects</div>
          <div className="text-2xl font-bold">{rows.length}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 bg-white">
          <div className="text-sm text-gray-500">Needing action</div>
          <div className="text-2xl font-bold text-red-600">{nonCompliant.length}</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 bg-white">
          <div className="text-sm text-gray-500">Escalated / open alerts</div>
          <div className="text-2xl font-bold text-orange-600">
            {escalated.length} / {openAlerts.length}
          </div>
        </div>
      </div>

      <Table
        title="Executive accountability portfolio"
        description="Governance health across all active public cloud projects."
        totalCount={nonCompliant.length}
        page={1}
        pageSize={nonCompliant.length || 10}
        isLoading={isLoading}
      >
        <TableBody data={nonCompliant} />
      </Table>
    </div>
  );
});
