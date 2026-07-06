'use client';

import { Badge } from '@mantine/core';
import EmptySearch from '@/components/EmptySearch';
import ExternalLink from '@/components/generic/button/ExternalLink';
import { PublicCloudAccountabilitySearchRow } from '@/services/db/public-cloud-accountability';

export default function TableBody({ data }: { data: PublicCloudAccountabilitySearchRow[] }) {
  if (data.length === 0) {
    return <EmptySearch />;
  }

  return (
    <div className="divide-y divide-grey-200/5">
      {data.map((row) => (
        <div
          key={row.licencePlate}
          className="hover:bg-gray-100 transition-colors duration-200 grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 sm:px-6"
        >
          <div className="md:col-span-4">
            <div className="font-semibold">{row.name}</div>
            <div className="text-sm text-gray-600">{row.licencePlate}</div>
            <div className="text-sm text-gray-500">{row.provider}</div>
          </div>
          <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Status</span>
              <div>
                <Badge size="sm" color={row.status === 'COMPLIANT' ? 'green' : 'red'}>
                  {row.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-gray-500">Open alert</span>
              <div>{row.highestOpenAlert ?? '—'}</div>
            </div>
            <div>
              <span className="text-gray-500">Variance</span>
              <div>{row.variancePercent != null ? `${row.variancePercent.toFixed(1)}%` : '—'}</div>
            </div>
            <div>
              <span className="text-gray-500">Quarterly</span>
              <div>
                {row.poSignedOff ? 'Signed off' : row.quarterlyReviewStatus ?? 'Pending'}
                {row.onEscalationList && (
                  <Badge className="ml-1" size="xs" color="orange">
                    Escalated
                  </Badge>
                )}
              </div>
            </div>
            <div className="col-span-2 md:col-span-4">
              <ExternalLink href={`/public-cloud/products/${row.licencePlate}/edit`} className="text-sm">
                View accountability
              </ExternalLink>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
