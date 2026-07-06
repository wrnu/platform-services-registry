import { z } from 'zod';
import { GlobalRole } from '@/constants';
import createApiHandler from '@/core/api-handler';
import prisma from '@/core/prisma';
import { BadRequestResponse, OkResponse, UnauthorizedResponse } from '@/core/responses';
import { AccountabilityAlertLevel } from '@/prisma/client';
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

  const existingAlert = await prisma.accountabilityAlert.findUnique({ where: { id: alertId } });
  if (!existingAlert || existingAlert.licencePlate !== licencePlate) {
    return BadRequestResponse('Alert not found');
  }

  const varianceLevels: AccountabilityAlertLevel[] = [
    AccountabilityAlertLevel.A1,
    AccountabilityAlertLevel.A2,
    AccountabilityAlertLevel.A3,
  ];
  if (varianceLevels.includes(existingAlert.level) && !body.explanation?.trim()) {
    return BadRequestResponse('Explanation is required for variance alerts');
  }

  const alert = await acknowledgeAlert(alertId, session.user.id, body.explanation?.trim());
  return OkResponse(alert);
});
