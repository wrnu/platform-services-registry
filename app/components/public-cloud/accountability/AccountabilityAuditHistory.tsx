'use client';

import { Badge, Table, Tabs } from '@mantine/core';
import { CloudCostForecastStatus } from '@/prisma/client';
import { formatCurrency } from '@/utils/js';

type ForecastRow = {
  id: string;
  version: number;
  status: CloudCostForecastStatus;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  changeJustification?: string | null;
  createdAt: string;
};

type AlertRow = {
  id: string;
  level: string;
  status: string;
  triggeredAt: string;
  periodYear: number;
  periodMonth: number;
  varianceAmount: number;
  variancePercent: number;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
};

type NotificationRow = {
  id: string;
  templateKey: string;
  scenario?: string | null;
  subject: string;
  recipients: string[];
  status: string;
  sentAt: string;
};

type EscalationRow = {
  id: string;
  fiscalYear: number;
  quarter: number;
  escalatedAt?: string | null;
  status: string;
};

function forecastStatusColor(status: CloudCostForecastStatus) {
  switch (status) {
    case CloudCostForecastStatus.APPROVED:
      return 'green';
    case CloudCostForecastStatus.REJECTED:
      return 'red';
    case CloudCostForecastStatus.PENDING_APPROVAL:
      return 'yellow';
    default:
      return 'gray';
  }
}

export default function AccountabilityAuditHistory({
  forecasts = [],
  alertHistory = [],
  notificationLogs = [],
  escalations = [],
}: {
  forecasts?: ForecastRow[];
  alertHistory?: AlertRow[];
  notificationLogs?: NotificationRow[];
  escalations?: EscalationRow[];
}) {
  return (
    <section>
      <h4 className="font-bold text-lg mb-2">Audit history</h4>
      <Tabs defaultValue="forecasts">
        <Tabs.List>
          <Tabs.Tab value="forecasts">Forecasts ({forecasts.length})</Tabs.Tab>
          <Tabs.Tab value="alerts">Alerts ({alertHistory.length})</Tabs.Tab>
          <Tabs.Tab value="notifications">Notifications ({notificationLogs.length})</Tabs.Tab>
          <Tabs.Tab value="escalations">Escalations ({escalations.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="forecasts" pt="md">
          {forecasts.length ? (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Submitted</Table.Th>
                  <Table.Th>Approved / rejected</Table.Th>
                  <Table.Th>Change note</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {forecasts.map((f) => (
                  <Table.Tr key={f.id}>
                    <Table.Td>v{f.version}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={forecastStatusColor(f.status)}>
                        {f.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{f.submittedAt ? new Date(f.submittedAt).toLocaleString() : '—'}</Table.Td>
                    <Table.Td>
                      {f.approvedAt && new Date(f.approvedAt).toLocaleString()}
                      {f.rejectedAt && (
                        <span className="text-red-700">
                          Rejected {new Date(f.rejectedAt).toLocaleString()}
                          {f.rejectionReason ? `: ${f.rejectionReason}` : ''}
                        </span>
                      )}
                      {!f.approvedAt && !f.rejectedAt && '—'}
                    </Table.Td>
                    <Table.Td className="max-w-xs truncate">{f.changeJustification ?? '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <p className="text-gray-600 text-sm">No forecast versions recorded.</p>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="alerts" pt="md">
          {alertHistory.length ? (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Level</Table.Th>
                  <Table.Th>Period</Table.Th>
                  <Table.Th>Triggered</Table.Th>
                  <Table.Th>Variance</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Resolved</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {alertHistory.map((alert) => (
                  <Table.Tr key={alert.id}>
                    <Table.Td>{alert.level}</Table.Td>
                    <Table.Td>
                      {alert.periodYear}-{String(alert.periodMonth).padStart(2, '0')}
                    </Table.Td>
                    <Table.Td>{new Date(alert.triggeredAt).toLocaleString()}</Table.Td>
                    <Table.Td>
                      {formatCurrency(alert.varianceAmount)} ({alert.variancePercent.toFixed(1)}%)
                    </Table.Td>
                    <Table.Td>{alert.status}</Table.Td>
                    <Table.Td>
                      {alert.resolvedAt
                        ? new Date(alert.resolvedAt).toLocaleString()
                        : alert.acknowledgedAt
                          ? `Ack ${new Date(alert.acknowledgedAt).toLocaleString()}`
                          : '—'}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <p className="text-gray-600 text-sm">No alert history.</p>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="notifications" pt="md">
          {notificationLogs.length ? (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Sent</Table.Th>
                  <Table.Th>Template</Table.Th>
                  <Table.Th>Subject</Table.Th>
                  <Table.Th>Recipients</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {notificationLogs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>{new Date(log.sentAt).toLocaleString()}</Table.Td>
                    <Table.Td>{log.templateKey}</Table.Td>
                    <Table.Td className="max-w-xs truncate">{log.subject}</Table.Td>
                    <Table.Td className="max-w-xs truncate">{log.recipients.join(', ')}</Table.Td>
                    <Table.Td>{log.status}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <p className="text-gray-600 text-sm">No notifications logged.</p>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="escalations" pt="md">
          {escalations.length ? (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Quarter</Table.Th>
                  <Table.Th>Escalated</Table.Th>
                  <Table.Th>Review status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {escalations.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      Q{row.quarter} FY{row.fiscalYear}
                    </Table.Td>
                    <Table.Td>{row.escalatedAt ? new Date(row.escalatedAt).toLocaleString() : '—'}</Table.Td>
                    <Table.Td>{row.status}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <p className="text-gray-600 text-sm">No quarterly escalations recorded.</p>
          )}
        </Tabs.Panel>
      </Tabs>
    </section>
  );
}
