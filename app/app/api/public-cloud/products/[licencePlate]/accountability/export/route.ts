import { z } from 'zod';
import { GlobalRole } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { accountabilityExportResponse, NoContent, UnauthorizedResponse } from '@/core/responses';
import { models } from '@/services/db';
import { buildProjectAccountabilityExportRows } from '@/services/db/public-cloud-accountability';
import { accountabilityExportQuerySchema } from '@/validation-schemas/cloud-cost';

const pathParamSchema = z.object({
  licencePlate: z.string(),
});

export const GET = createApiHandler({
  roles: [GlobalRole.User],
  validations: {
    pathParams: pathParamSchema,
    queryParams: accountabilityExportQuerySchema,
  },
})(async ({ pathParams, queryParams, session }) => {
  const { licencePlate } = pathParams;
  const { format } = queryParams;

  const { data: product } = await models.publicCloudProduct.get({ where: { licencePlate } }, session);
  if (!product?._permissions.viewAccountability) {
    return UnauthorizedResponse();
  }

  const rows = await buildProjectAccountabilityExportRows(licencePlate);
  if (!rows.length) {
    return NoContent();
  }

  return accountabilityExportResponse(rows, `${licencePlate}-accountability`, format);
});
