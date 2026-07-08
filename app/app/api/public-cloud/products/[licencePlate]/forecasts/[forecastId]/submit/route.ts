import { z } from 'zod';
import { GlobalRole } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { BadRequestResponse, OkResponse, UnauthorizedResponse } from '@/core/responses';
import { sendForecastSubmittedEmail } from '@/services/ches/public-cloud/accountability-emails';
import { models } from '@/services/db';
import { submitForecast } from '@/services/db/public-cloud-accountability';
import { objectId } from '@/validation-schemas';

const pathParamSchema = z.object({
  licencePlate: z.string(),
  forecastId: objectId,
});

export const POST = createApiHandler({
  roles: [GlobalRole.User],
  validations: { pathParams: pathParamSchema },
})(async ({ pathParams, session }) => {
  const { licencePlate, forecastId } = pathParams;
  const { data: product } = await models.publicCloudProduct.get({ where: { licencePlate } }, session);
  if (!product?._permissions.editForecast) {
    return UnauthorizedResponse();
  }

  try {
    const forecast = await submitForecast(licencePlate, forecastId, session.user.id);
    await sendForecastSubmittedEmail(licencePlate, forecast);
    return OkResponse(forecast);
  } catch (e) {
    return BadRequestResponse((e as Error).message);
  }
});
