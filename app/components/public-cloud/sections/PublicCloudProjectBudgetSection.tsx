'use client';

import { Alert, Badge, Button, Modal, Table, Textarea } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Budget from '@/components/form/Budget';
import LoadingBox from '@/components/generic/LoadingBox';
import AccountabilityAuditHistory from '@/components/public-cloud/accountability/AccountabilityAuditHistory';
import AccountabilityGuidancePanel from '@/components/public-cloud/accountability/AccountabilityGuidancePanel';
import AccountabilityQuarterlyChecklist from '@/components/public-cloud/accountability/AccountabilityQuarterlyChecklist';
import AlertResponseModal from '@/components/public-cloud/accountability/AlertResponseModal';
import { FISCAL_FORECAST_HORIZON_MONTHS } from '@/components/public-cloud/accountability/forecast-grid-utils';
import ProjectBudgetForecastPanel from '@/components/public-cloud/accountability/ProjectBudgetForecastPanel';
import CurrentMonthSpendPanel from '@/components/public-cloud/costs/CurrentMonthSpendPanel';
import { Provider } from '@/prisma/client';
import {
  approvePublicCloudForecast,
  createPublicCloudForecast,
  getPublicCloudAccountability,
  rejectPublicCloudForecast,
  signOffPublicCloudQuarterlyReview,
  submitPublicCloudForecast,
} from '@/services/backend/public-cloud/accountability';
import { usePublicProductState } from '@/states/global';
import { formatCurrency } from '@/utils/js';

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge color="gray">Unknown</Badge>;
  const color =
    status === 'COMPLIANT' ? 'green' : status.includes('REQUIRED') || status === 'NON_COMPLIANT' ? 'red' : 'yellow';
  return <Badge color={color}>{status.replace(/_/g, ' ')}</Badge>;
}

export default function PublicCloudProjectBudgetSection({
  disabled,
  licencePlate,
  sessionUserId,
}: {
  disabled?: boolean;
  licencePlate: string;
  sessionUserId?: string;
}) {
  const [, productSnap] = usePublicProductState();
  const product = productSnap.currentProduct;
  const canViewAccountability = product?._permissions?.viewAccountability;
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['accountability', licencePlate],
    queryFn: () => getPublicCloudAccountability(licencePlate),
    enabled: !!licencePlate && canViewAccountability,
    retry: 1,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['accountability', licencePlate] });

  const createForecast = useMutation({
    mutationFn: () => createPublicCloudForecast(licencePlate),
    onSuccess: refresh,
  });

  const submitForecast = useMutation({
    mutationFn: (forecastId: string) => submitPublicCloudForecast(licencePlate, forecastId),
    onSuccess: refresh,
  });

  const approveForecast = useMutation({
    mutationFn: (forecastId: string) => approvePublicCloudForecast(licencePlate, forecastId),
    onSuccess: refresh,
  });

  const rejectForecast = useMutation({
    mutationFn: ({ forecastId, rejectionReason }: { forecastId: string; rejectionReason: string }) =>
      rejectPublicCloudForecast(licencePlate, forecastId, rejectionReason),
    onSuccess: () => {
      setRejectModalOpen(false);
      setRejectionReason('');
      refresh();
    },
  });

  const signOffQuarterly = useMutation({
    mutationFn: () => signOffPublicCloudQuarterlyReview(licencePlate),
    onSuccess: refresh,
  });

  const [alertModal, setAlertModal] = useState<{
    alertId: string;
    level: string;
    mode: 'acknowledge' | 'resolve';
  } | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [pendingRejectForecastId, setPendingRejectForecastId] = useState<string | null>(null);

  const permissions = product?._permissions;
  const accountabilityCurrency = data?.snapshot?.currency ?? (product?.provider === Provider.AZURE ? 'CAD' : 'USD');

  const forecastActions = data
    ? (() => {
        const draftForecast = data.forecasts?.find((f: { status: string }) => f.status === 'DRAFT');
        const pendingForecast = data.forecasts?.find((f: { status: string }) => f.status === 'PENDING_APPROVAL');
        const latestRejected = [...(data.forecasts ?? [])]
          .filter((f: { status: string }) => f.status === 'REJECTED')
          .sort((a: { version: number }, b: { version: number }) => b.version - a.version)[0];

        return (
          <div className="space-y-3">
            {latestRejected && !draftForecast && !pendingForecast && (
              <Alert color="orange" title="Latest forecast was rejected">
                {latestRejected.rejectionReason ?? 'No rejection reason provided.'}
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              {permissions?.editForecast && !draftForecast && !pendingForecast && (
                <Button type="button" loading={createForecast.isPending} onClick={() => createForecast.mutate()}>
                  Create forecast from product budget
                </Button>
              )}
              {draftForecast && permissions?.editForecast && (
                <Button
                  type="button"
                  loading={submitForecast.isPending}
                  onClick={() => submitForecast.mutate(draftForecast.id)}
                >
                  Submit forecast for approval
                </Button>
              )}
              {pendingForecast && permissions?.approveForecast && (
                <>
                  <Button
                    type="button"
                    loading={approveForecast.isPending}
                    onClick={() => approveForecast.mutate(pendingForecast.id)}
                  >
                    Approve forecast
                  </Button>
                  <Button
                    type="button"
                    color="red"
                    variant="light"
                    onClick={() => {
                      setPendingRejectForecastId(pendingForecast.id);
                      setRejectModalOpen(true);
                    }}
                  >
                    Reject forecast
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })()
    : null;

  const monthlyActuals =
    data?.spendHistory?.months?.map((m: { year: number; month: number; actualTotal: number }) => ({
      year: m.year,
      month: m.month,
      amount: m.actualTotal,
    })) ?? [];

  return (
    <div className="space-y-8">
      <Budget disabled={disabled} mode="edit" />

      {canViewAccountability && (
        <>
          {isLoading && (
            <LoadingBox isLoading>
              <div className="min-h-24" />
            </LoadingBox>
          )}

          {isError && (
            <Alert color="red" title="Could not load spend forecast">
              <p className="mb-3">
                {(error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
                  (error as Error)?.message ??
                  'Failed to load accountability data'}
              </p>
              <Button type="button" size="xs" variant="light" onClick={() => refetch()}>
                Retry
              </Button>
            </Alert>
          )}

          {data && (
            <>
              <section className="flex flex-wrap items-center gap-3">
                <h3 className="font-bold text-lg">Spend accountability</h3>
                <StatusBadge status={data.state?.status} />
                {data.state?.highestOpenAlert && <Badge color="orange">Open: {data.state.highestOpenAlert}</Badge>}
                {data.activeForecast && !data.forecasts?.find((f: { status: string }) => f.status === 'DRAFT') && (
                  <Badge variant="light" color="green">
                    Approved forecast v{data.activeForecast.version}
                  </Badge>
                )}
                {data.forecasts?.find((f: { status: string }) => f.status === 'PENDING_APPROVAL') && (
                  <Badge variant="light" color="yellow">
                    Pending approval
                  </Badge>
                )}
              </section>

              <AccountabilityGuidancePanel />

              <CurrentMonthSpendPanel snapshot={data.snapshot} />

              <section className="space-y-4">
                <h4 className="font-semibold">Fiscal year forecast</h4>
                {(() => {
                  const draftForecast = data.forecasts?.find((f: { status: string }) => f.status === 'DRAFT');
                  const displayForecast = draftForecast ?? data.activeForecast;
                  const activeBaseline = data.activeForecast?.monthlyValues ?? null;

                  if (!displayForecast) {
                    return (
                      <div className="text-sm text-gray-600 space-y-3">
                        <p>No forecast yet. Create a fiscal year forecast from your product budget estimates.</p>
                        {forecastActions}
                      </div>
                    );
                  }

                  return (
                    <>
                      <ProjectBudgetForecastPanel
                        licencePlate={licencePlate}
                        provider={product?.provider}
                        forecast={{
                          id: displayForecast.id,
                          version: displayForecast.version,
                          status: displayForecast.status,
                          horizonMonths: displayForecast.horizonMonths ?? FISCAL_FORECAST_HORIZON_MONTHS,
                          updatedAt: displayForecast.updatedAt,
                        }}
                        monthlyValues={displayForecast.monthlyValues ?? []}
                        monthlyActuals={monthlyActuals}
                        activeBaseline={draftForecast ? activeBaseline : null}
                        quarterlyReview={data.quarterlyReview}
                        editable={Boolean(draftForecast && permissions?.editForecast)}
                        onSaved={refresh}
                      />
                      {forecastActions}
                    </>
                  );
                })()}
              </section>

              {data.quarterlyReview && (
                <section className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
                  <div>
                    <h4 className="font-bold text-lg">Quarterly review</h4>
                    <p className="text-sm text-gray-600">
                      Q{data.quarterlyReview.quarter} {data.quarterlyReview.fiscalYear} — {data.quarterlyReview.status}
                    </p>
                  </div>
                  <AccountabilityQuarterlyChecklist
                    licencePlate={licencePlate}
                    review={data.quarterlyReview}
                    editable={permissions?.editForecast ?? false}
                    onUpdated={refresh}
                  />
                  {data.spendHistory?.months?.length && (
                    <div>
                      <h5 className="font-semibold mb-2 text-sm">Past three months spend (CSP)</h5>
                      <Table striped className="max-w-xl">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Month</Table.Th>
                            <Table.Th>Actual</Table.Th>
                            <Table.Th>Forecast</Table.Th>
                            <Table.Th>Variance</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {data.spendHistory.months
                            .slice(-3)
                            .map(
                              (m: {
                                year: number;
                                month: number;
                                actualTotal: number;
                                forecastTotal?: number;
                                variancePercent?: number;
                              }) => (
                                <Table.Tr key={`${m.year}-${m.month}`}>
                                  <Table.Td>
                                    {m.year}-{String(m.month).padStart(2, '0')}
                                  </Table.Td>
                                  <Table.Td>{formatCurrency(m.actualTotal)}</Table.Td>
                                  <Table.Td>{m.forecastTotal != null ? formatCurrency(m.forecastTotal) : '—'}</Table.Td>
                                  <Table.Td>
                                    {m.variancePercent != null ? `${m.variancePercent.toFixed(1)}%` : '—'}
                                  </Table.Td>
                                </Table.Tr>
                              ),
                            )}
                        </Table.Tbody>
                      </Table>
                    </div>
                  )}
                  {sessionUserId === product?.projectOwnerId && !data.quarterlyReview.poSignedOff && (
                    <Button
                      type="button"
                      loading={signOffQuarterly.isPending}
                      onClick={() => signOffQuarterly.mutate()}
                    >
                      PO sign-off
                    </Button>
                  )}
                </section>
              )}

              <section>
                <h4 className="font-bold text-lg mb-2">Open alerts</h4>
                {data.openAlerts?.length ? (
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Level</Table.Th>
                        <Table.Th>Triggered</Table.Th>
                        <Table.Th>Variance</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.openAlerts.map(
                        (alert: {
                          id: string;
                          level: string;
                          triggeredAt: string;
                          varianceAmount: number;
                          variancePercent: number;
                          status: string;
                        }) => (
                          <Table.Tr key={alert.id}>
                            <Table.Td>{alert.level}</Table.Td>
                            <Table.Td>{new Date(alert.triggeredAt).toLocaleString()}</Table.Td>
                            <Table.Td>
                              {formatCurrency(alert.varianceAmount, { currency: accountabilityCurrency })} (
                              {alert.variancePercent.toFixed(1)}%)
                            </Table.Td>
                            <Table.Td>{alert.status}</Table.Td>
                            <Table.Td className="space-x-2">
                              {permissions?.respondAccountabilityAlert && alert.status === 'OPEN' && (
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="light"
                                  onClick={() =>
                                    setAlertModal({ alertId: alert.id, level: alert.level, mode: 'acknowledge' })
                                  }
                                >
                                  Acknowledge
                                </Button>
                              )}
                              {permissions?.respondAccountabilityAlert && (
                                <Button
                                  type="button"
                                  size="xs"
                                  onClick={() =>
                                    setAlertModal({ alertId: alert.id, level: alert.level, mode: 'resolve' })
                                  }
                                >
                                  Resolve
                                </Button>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ),
                      )}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <p className="text-gray-600 text-sm">No open alerts.</p>
                )}
              </section>

              <AccountabilityAuditHistory
                forecasts={data.forecasts}
                alertHistory={data.alertHistory}
                notificationLogs={data.notificationLogs}
                escalations={data.escalations}
                currency={accountabilityCurrency}
              />

              {alertModal && (
                <AlertResponseModal
                  licencePlate={licencePlate}
                  alertId={alertModal.alertId}
                  alertLevel={alertModal.level}
                  mode={alertModal.mode}
                  opened={!!alertModal}
                  onClose={() => setAlertModal(null)}
                  onComplete={refresh}
                />
              )}

              <Modal
                opened={rejectModalOpen}
                onClose={() => setRejectModalOpen(false)}
                title="Reject forecast"
                centered
              >
                <div className="space-y-4">
                  <Textarea
                    label="Rejection reason"
                    required
                    minRows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.currentTarget.value)}
                    placeholder="Explain what must change before this forecast can be approved..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="default" onClick={() => setRejectModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      color="red"
                      loading={rejectForecast.isPending}
                      disabled={!rejectionReason.trim() || !pendingRejectForecastId}
                      onClick={() => {
                        if (!pendingRejectForecastId) return;
                        rejectForecast.mutate({
                          forecastId: pendingRejectForecastId,
                          rejectionReason: rejectionReason.trim(),
                        });
                      }}
                    >
                      Reject forecast
                    </Button>
                  </div>
                </div>
              </Modal>
            </>
          )}
        </>
      )}
    </div>
  );
}
