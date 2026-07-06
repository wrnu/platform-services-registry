import { GlobalPermissions } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { OkResponse } from '@/core/responses';
import { toCloudCostRulesConfigData, createCloudCostRulesConfig } from '@/services/db/cloud-cost-rules';
import { cloudCostRulesConfigBodySchema } from '@/validation-schemas';

export const POST = createApiHandler({
  permissions: [GlobalPermissions.ManagePublicCloudCostRules],
  validations: { body: cloudCostRulesConfigBodySchema },
})(async ({ body, session }) => {
  const config = await createCloudCostRulesConfig(body, session.user.id);
  return OkResponse(config);
});
