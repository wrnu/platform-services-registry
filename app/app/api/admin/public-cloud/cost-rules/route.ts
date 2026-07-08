import { GlobalPermissions } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { OkResponse } from '@/core/responses';
import { getActiveCloudCostRulesConfig, listCloudCostRulesConfigs } from '@/services/db/cloud-cost-rules';

export const GET = createApiHandler({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
})(async () => {
  const [active, versions] = await Promise.all([getActiveCloudCostRulesConfig(), listCloudCostRulesConfigs()]);

  return OkResponse({ active, versions });
});
