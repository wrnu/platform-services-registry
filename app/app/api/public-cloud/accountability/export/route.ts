import { GlobalPermissions } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { CsvResponse, NoContent } from '@/core/responses';
import { buildBundledAccountabilityExportRows } from '@/services/db/public-cloud-accountability';
import { accountabilityExportBodySchema } from '@/validation-schemas/cloud-cost';

export const POST = createApiHandler({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  validations: { body: accountabilityExportBodySchema },
})(async ({ body }) => {
  const rows = await buildBundledAccountabilityExportRows(body.provider);
  if (!rows.length) {
    return NoContent();
  }

  const suffix = body.provider ? body.provider.toLowerCase() : 'all';
  return CsvResponse(rows, `public-cloud-accountability-${suffix}.csv`);
});
