import { GlobalPermissions } from '@/constants';
import { DEFAULT_CLOUD_COST_RULES } from '@/constants/cloud-cost-rules';
import createApiHandler from '@/core/api-handler';
import { OkResponse } from '@/core/responses';
import {
  getActiveCloudCostRulesConfig,
  previewCloudCostRules,
  toCloudCostRulesConfigData,
} from '@/services/db/cloud-cost-rules';
import { cloudCostRulesPreviewBodySchema, CloudCostRulesConfigBody } from '@/validation-schemas';

export const POST = createApiHandler({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  validations: { body: cloudCostRulesPreviewBodySchema },
})(async ({ body }) => {
  const active = await getActiveCloudCostRulesConfig();
  const rules = body.rules
    ? toCloudCostRulesConfigData(body.rules)
    : toCloudCostRulesConfigData({
        varianceThresholds: active.varianceThresholds as CloudCostRulesConfigBody['varianceThresholds'],
        consumptionMilestones: active.consumptionMilestones,
        earlyPaceWarning: active.earlyPaceWarning,
        forecastPolicy: active.forecastPolicy,
        quarterlyReview: active.quarterlyReview,
        reminderPolicy: active.reminderPolicy,
        monthlyRecapDayOfMonth: active.monthlyRecapDayOfMonth,
        projectionMethod: active.projectionMethod,
        notificationRouting: active.notificationRouting ?? DEFAULT_CLOUD_COST_RULES.notificationRouting,
      });

  const preview = previewCloudCostRules(
    {
      forecastAmount: body.forecastAmount,
      spendToDate: body.spendToDate,
      dayOfMonth: body.dayOfMonth,
    },
    rules,
  );

  return OkResponse({ preview, activeRulesVersion: active.version, defaults: DEFAULT_CLOUD_COST_RULES });
});
