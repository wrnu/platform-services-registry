'use client';

import { Table, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import EmptySearch from '@/components/EmptySearch';
import LoadingBox from '@/components/generic/LoadingBox';
import { GlobalPermissions } from '@/constants';
import createClientPage from '@/core/client-page';
import { searchAccountabilityNotifications } from '@/services/backend/public-cloud/accountability';

const auditPage = createClientPage({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  fallbackUrl: 'login?callbackUrl=/home',
});

export default auditPage(() => {
  const [search, setSearch] = useState('');
  const [licencePlate, setLicencePlate] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['accountability-notification-audit', search, licencePlate],
    queryFn: () =>
      searchAccountabilityNotifications({
        search: search || undefined,
        licencePlate: licencePlate || undefined,
        page: 1,
        pageSize: 100,
      }),
  });

  const rows = data?.data ?? [];

  return (
    <LoadingBox isLoading={isLoading}>
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-2xl font-bold">Accountability notification audit</h1>
          <p className="text-sm text-gray-600 mt-1">
            CHES sends for public cloud accountability workflows (Story 7.5).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <TextInput
            label="Search subject or licence plate"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onBlur={() => refetch()}
          />
          <TextInput
            label="Licence plate filter"
            value={licencePlate}
            onChange={(e) => setLicencePlate(e.currentTarget.value)}
            onBlur={() => refetch()}
          />
        </div>

        {isFetching && <p className="text-sm text-gray-500">Refreshing…</p>}

        {!rows.length ? (
          <EmptySearch />
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Sent</Table.Th>
                <Table.Th>Licence plate</Table.Th>
                <Table.Th>Template</Table.Th>
                <Table.Th>Subject</Table.Th>
                <Table.Th>Recipients</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map(
                (row: {
                  id: string;
                  sentAt: string;
                  licencePlate?: string | null;
                  templateKey: string;
                  subject: string;
                  recipients: string[];
                  status: string;
                }) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>{new Date(row.sentAt).toLocaleString()}</Table.Td>
                    <Table.Td>{row.licencePlate ?? '—'}</Table.Td>
                    <Table.Td>{row.templateKey}</Table.Td>
                    <Table.Td className="max-w-md truncate">{row.subject}</Table.Td>
                    <Table.Td className="max-w-md truncate">{row.recipients.join(', ')}</Table.Td>
                    <Table.Td>{row.status}</Table.Td>
                  </Table.Tr>
                ),
              )}
            </Table.Tbody>
          </Table>
        )}
      </div>
    </LoadingBox>
  );
});
