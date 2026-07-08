import { z } from 'zod';
import { GlobalRole } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { BadRequestResponse, OkResponse, UnauthorizedResponse } from '@/core/responses';
import { sendForecastRejectedEmail } from '@/services/ches/public-cloud/accountability-emails';
import { models } from '@/services/db';
import { rejectForecast } from '@/services/db/public-cloud-accountability';
import { objectId } from '@/validation-schemas';
import { rejectForecastBodySchema } from '@/validation-schemas/cloud-cost';

const pathParamSchema = z.object({
  licencePlate: z.string(),
  forecastId: objectId,
});

export const POST = createApiHandler({
  roles: [GlobalRole.User],
  validations: { pathParams: pathParamSchema, body: rejectForecastBodySchema },
})(async ({ pathParams, session, body }) => {
  const { licencePlate, forecastId } = pathParams;
  const { data: product } = await models.publicCloudProduct.get({ where: { licencePlate } }, session);
  if (!product?._permissions.approveForecast) {
    return UnauthorizedResponse();
  }

  try {
    const forecast = await rejectForecast(licencePlate, forecastId, session.user.id, body.rejectionReason);
    await sendForecastRejectedEmail(licencePlate, forecast);
    return OkResponse(forecast);
  } catch (e) {
    return BadRequestResponse((e as Error).message);
  }
});
