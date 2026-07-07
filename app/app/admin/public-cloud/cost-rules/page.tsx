'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Badge, Button, NumberInput, Table } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import FormErrorNotification from '@/components/generic/FormErrorNotification';
import HookFormTextInput from '@/components/generic/input/HookFormTextInput';
import LoadingBox from '@/components/generic/LoadingBox';
import { openConfirmModal } from '@/components/modal/confirm';
import { GlobalPermissions } from '@/constants';
import { DEFAULT_CLOUD_COST_RULES } from '@/constants/cloud-cost-rules';
import createClientPage from '@/core/client-page';
import {
  createCloudCostRulesConfig,
  getCloudCostRulesConfig,
  previewCloudCostRules,
} from '@/services/backend/admin/public-cloud-cost-rules';
import { CloudCostRulesConfigBody, cloudCostRulesConfigBodySchema } from '@/validation-schemas';

const CostRulesPage = createClientPage({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
});

function mapActiveToForm(active: CloudCostRulesConfigBody): CloudCostRulesConfigBody {
  return {
    varianceThresholds: active.varianceThresholds,
    consumptionMilestones: active.consumptionMilestones,
    earlyPaceWarning: active.earlyPaceWarning,
    forecastPolicy: active.forecastPolicy,
    quarterlyReview: active.quarterlyReview,
    reminderPolicy: active.reminderPolicy,
    monthlyRecapDayOfMonth: active.monthlyRecapDayOfMonth,
    projectionMethod: active.projectionMethod,
  };
}

function RuleGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/80 p-4 space-y-3">
      <div>
        <h3 className="font-medium text-sm text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export default CostRulesPage(({ session }) => {
  const canEdit = session?.permissions.managePublicCloudCostRules;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cloudCostRules'],
    queryFn: getCloudCostRulesConfig,
  });

  const methods = useForm<CloudCostRulesConfigBody>({
    resolver: zodResolver(cloudCostRulesConfigBodySchema),
    defaultValues: DEFAULT_CLOUD_COST_RULES,
    disabled: !canEdit,
  });

  useEffect(() => {
    if (data?.active) {
      methods.reset(mapActiveToForm(data.active));
    }
  }, [data?.active, methods]);

  const [previewForecast, setPreviewForecast] = useState(1000);
  const [previewSpend, setPreviewSpend] = useState(1200);
  const [previewDay, setPreviewDay] = useState(10);

  const save = useMutation({
    mutationFn: (body: CloudCostRulesConfigBody) => createCloudCostRulesConfig(body),
    onSuccess: () => refetch(),
  });

  const preview = useMutation({
    mutationFn: () =>
      previewCloudCostRules({
        forecastAmount: previewForecast,
        spendToDate: previewSpend,
        dayOfMonth: previewDay,
        rules: methods.getValues(),
      }),
  });

  const onSubmit = methods.handleSubmit(async (values) => {
    const res = await openConfirmModal({
      content: 'This creates a new active rules version. Previous versions are retained for audit.',
      submitColor: 'primary',
    });
    if (res.state.confirmed) await save.mutateAsync(values);
  });

  return (
    <LoadingBox isLoading={isLoading}>
      <div className="space-y-8 p-4 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Public Cloud cost rules</h1>
          {data?.active && (
            <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
              Active version <Badge size="sm">v{data.active.version}</Badge>
            </div>
          )}
        </div>

        <FormProvider {...methods}>
          <form onSubmit={onSubmit} className="space-y-6">
            <FormErrorNotification />
            <section className="space-y-4">
              <div>
                <h2 className="font-semibold">Variance alerts (A1–A3)</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Formal variance alerts when spend exceeds the approved monthly forecast. Higher levels add more admin
                  recipients. Evaluate percent and dollar rules; assign the highest severity that matches.
                </p>
              </div>

              <div className="space-y-3">
                <RuleGroup title="A1 — moderate variance" description="Spend more than this percent above forecast.">
                  <HookFormTextInput name="varianceThresholds.a1.percentAbove" label="% above forecast" />
                </RuleGroup>

                <RuleGroup
                  title="A2 — high variance"
                  description="Fires if spend exceeds either the percent threshold or the dollar threshold."
                >
                  <HookFormTextInput name="varianceThresholds.a2.percentAbove" label="% above forecast" />
                  <HookFormTextInput name="varianceThresholds.a2.dollarsAbove" label="$ above forecast" />
                </RuleGroup>

                <RuleGroup
                  title="A3 — critical variance"
                  description="Fires if spend exceeds the dollar threshold, or exceeds the percent threshold with at least the minimum dollar variance."
                >
                  <HookFormTextInput name="varianceThresholds.a3.percentAbove" label="% above forecast" />
                  <HookFormTextInput name="varianceThresholds.a3.minDollarsAbove" label="Min $ above (for % rule)" />
                  <HookFormTextInput name="varianceThresholds.a3.dollarsAbove" label="$ above forecast" />
                </RuleGroup>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="font-semibold">Consumption notices</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Informational emails to the project team — not the same as A1–A3 variance alerts.
                </p>
              </div>

              <div className="space-y-3">
                <RuleGroup
                  title="Milestone emails"
                  description="Fixed tiers at 50%, 80%, and 100% of forecast (not editable here). Above 100%, emails repeat every step percent (e.g. 125%, 150%, …)."
                >
                  <HookFormTextInput name="consumptionMilestones.stepPercent" label="Step % above 100% forecast" />
                </RuleGroup>

                <RuleGroup
                  title="Early pace warning"
                  description="If spend reaches the pace percent on or before the day of month, send an early warning (e.g. 50% of forecast by day 10)."
                >
                  <HookFormTextInput name="earlyPaceWarning.percentOfForecast" label="% of forecast consumed" />
                  <HookFormTextInput name="earlyPaceWarning.byDayOfMonth" label="By day of month (inclusive)" />
                </RuleGroup>

                <RuleGroup
                  title="Pre-emptive notice (A0)"
                  description="Softer early notice before the full pace warning fires (e.g. 30% of forecast by day 5)."
                >
                  <HookFormTextInput
                    name="earlyPaceWarning.preemptivePercentOfForecast"
                    label="Pre-emptive % of forecast"
                  />
                  <HookFormTextInput
                    name="earlyPaceWarning.preemptiveByDayOfMonth"
                    label="Pre-emptive by day of month"
                  />
                </RuleGroup>

                <RuleGroup
                  title="Monthly accountability recap"
                  description="Day of month when the bundled recap email is sent to Cloud PO, Cloud Director, and Finance Director."
                >
                  <HookFormTextInput name="monthlyRecapDayOfMonth" label="Day of month" />
                </RuleGroup>
              </div>
            </section>

            {canEdit && (
              <Button type="submit" loading={save.isPending} color="primary">
                Save as new version
              </Button>
            )}
          </form>
        </FormProvider>

        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Rule preview</h2>
            <p className="text-sm text-gray-600 mt-1">
              Test which rules would fire for a given forecast, spend, and calendar day.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            <NumberInput
              label="Forecast"
              value={previewForecast}
              onChange={(v) => setPreviewForecast(Number(v) || 0)}
            />
            <NumberInput label="Spend to date" value={previewSpend} onChange={(v) => setPreviewSpend(Number(v) || 0)} />
            <NumberInput
              label="Day of month"
              value={previewDay}
              onChange={(v) => setPreviewDay(Number(v) || 1)}
              min={1}
              max={31}
            />
          </div>
          <Button variant="light" loading={preview.isPending} onClick={() => preview.mutate()}>
            Run preview
          </Button>
          {preview.data?.preview && (
            <pre className="mt-4 p-3 bg-gray-100 rounded text-sm overflow-auto">
              {JSON.stringify(preview.data.preview, null, 2)}
            </pre>
          )}
        </section>

        {data?.versions?.length > 0 && (
          <section>
            <h2 className="font-semibold mb-3">Version history</h2>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Active</Table.Th>
                  <Table.Th>Created</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.versions.map((v: { version: number; isActive: boolean; createdAt: string }) => (
                  <Table.Tr key={v.version}>
                    <Table.Td>v{v.version}</Table.Td>
                    <Table.Td>{v.isActive ? 'Yes' : 'No'}</Table.Td>
                    <Table.Td>{new Date(v.createdAt).toLocaleString()}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </section>
        )}
      </div>
    </LoadingBox>
  );
});
