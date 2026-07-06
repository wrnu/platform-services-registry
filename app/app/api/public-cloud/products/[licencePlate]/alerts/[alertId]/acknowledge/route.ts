import { z } from 'zod';
import { GlobalRole } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { OkResponse, UnauthorizedResponse } from '@/core/responses';
import { models } from '@/services/db';
import { acknowledgeAlert } from '@/services/db/public-cloud-accountability';
import { objectId } from '@/validation-schemas';
import { acknowledgeAlertBodySchema } from '@/validation-schemas/cloud-cost';

const pathParamSchema = z.object({
  licencePlate: z.string(),
  alertId: objectId,
});

export const POST = createApiHandler({
  roles: [GlobalRole.User],
  validations: { pathParams: pathParamSchema, body: acknowledgeAlertBodySchema },
})(async ({ pathParams, body, session }) => {
  const { licencePlate, alertId } = pathParams;
  const { data: product } = await models.publicCloudProduct.get({ where: { licencePlate } }, session);
  if (!product?._permissions.respondAccountabilityAlert) {
    return UnauthorizedResponse();
  }

  const alert = await acknowledgeAlert(alertId, session.user.id, body.explanation);
  return OkResponse(alert);
});
