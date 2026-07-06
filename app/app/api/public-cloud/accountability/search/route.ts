import { GlobalPermissions } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { OkResponse } from '@/core/responses';
import { searchPublicCloudAccountability } from '@/services/db/public-cloud-accountability';
import { publicCloudAccountabilitySearchBodySchema } from '@/validation-schemas';

export const POST = createApiHandler({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  validations: { body: publicCloudAccountabilitySearchBodySchema },
})(async ({ body }) => {
  const { data, totalCount } = await searchPublicCloudAccountability(body);
  return OkResponse({ data, totalCount });
});
