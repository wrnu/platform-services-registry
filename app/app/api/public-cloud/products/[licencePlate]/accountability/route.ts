import { z } from 'zod';
import { GlobalRole } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { OkResponse, UnauthorizedResponse } from '@/core/responses';
import { models } from '@/services/db';
import { getAccountabilitySummary, recomputeAccountabilityState } from '@/services/db/public-cloud-accountability';

const pathParamSchema = z.object({
  licencePlate: z.string(),
});

export const GET = createApiHandler({
  roles: [GlobalRole.User],
  validations: { pathParams: pathParamSchema },
})(async ({ pathParams, session }) => {
  const { licencePlate } = pathParams;

  const { data: product } = await models.publicCloudProduct.get({ where: { licencePlate } }, session);
  if (!product?._permissions.viewAccountability) {
    return UnauthorizedResponse();
  }

  let summary = await getAccountabilitySummary(licencePlate);

  if (!summary.state) {
    await recomputeAccountabilityState(licencePlate);
    summary = await getAccountabilitySummary(licencePlate);
  }

  return OkResponse(summary);
});
