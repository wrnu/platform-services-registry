import { GlobalPermissions } from '@/constants';
import { DEFAULT_CLOUD_COST_RULES, previewRuleEvaluation } from '@/constants/cloud-cost-rules';
import createApiHandler from '@/core/api-handler';
import { OkResponse } from '@/core/responses';
import {
  getActiveCloudCostRulesConfig,
  rulesConfigModelToData,
  toCloudCostRulesConfigData,
} from '@/services/db/cloud-cost-rules';
import { cloudCostRulesPreviewBodySchema } from '@/validation-schemas';

export const POST = createApiHandler({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  validations: { body: cloudCostRulesPreviewBodySchema },
})(async ({ body }) => {
  const active = await getActiveCloudCostRulesConfig();
  const rules = body.rules ? toCloudCostRulesConfigData(body.rules) : rulesConfigModelToData(active);

  const preview = previewRuleEvaluation(
    {
      forecastAmount: body.forecastAmount,
      spendToDate: body.spendToDate,
      dayOfMonth: body.dayOfMonth,
    },
    rules,
  );

  return OkResponse({ preview, activeRulesVersion: active.version, defaults: DEFAULT_CLOUD_COST_RULES });
});
