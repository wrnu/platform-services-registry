import { z } from 'zod';
import { GlobalRole } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { OkResponse, UnauthorizedResponse } from '@/core/responses';
import { models } from '@/services/db';
import {
  getOrCreateCurrentQuarterlyReview,
  signOffQuarterlyReview,
  updateQuarterlyReview,
} from '@/services/db/public-cloud-accountability';
import { quarterlyReviewUpdateBodySchema } from '@/validation-schemas/cloud-cost';

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

  const review = await getOrCreateCurrentQuarterlyReview(licencePlate);
  return OkResponse(review);
});

export const PUT = createApiHandler({
  roles: [GlobalRole.User],
  validations: { pathParams: pathParamSchema, body: quarterlyReviewUpdateBodySchema },
})(async ({ pathParams, body, session }) => {
  const { licencePlate } = pathParams;
  const { data: product } = await models.publicCloudProduct.get({ where: { licencePlate } }, session);
  if (!product?._permissions.editForecast) {
    return UnauthorizedResponse();
  }

  const review = await updateQuarterlyReview(licencePlate, body);
  return OkResponse(review);
});

export const POST = createApiHandler({
  roles: [GlobalRole.User],
  validations: { pathParams: pathParamSchema },
})(async ({ pathParams, session }) => {
  const { licencePlate } = pathParams;
  const { data: product } = await models.publicCloudProduct.get({ where: { licencePlate } }, session);
  if (!product || product.projectOwnerId !== session.user.id) {
    return UnauthorizedResponse();
  }

  const review = await signOffQuarterlyReview(licencePlate, session.user.id);
  return OkResponse(review);
});
