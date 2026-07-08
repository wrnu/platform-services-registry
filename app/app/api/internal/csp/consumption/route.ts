import createApiHandler from '@/core/api-handler';
import { OkResponse } from '@/core/responses';
import { maybeSendPreemptiveThresholdNotice } from '@/services/ches/public-cloud/accountability-emails';
import { upsertConsumptionSnapshot } from '@/services/db/public-cloud-accountability';
import { cspConsumptionSnapshotSchema } from '@/validation-schemas/cloud-cost';

export const PUT = createApiHandler({
  roles: ['service-account'],
  useServiceAccount: true,
  validations: { body: cspConsumptionSnapshotSchema },
})(async ({ body }) => {
  const snapshot = await upsertConsumptionSnapshot(body);
  await maybeSendPreemptiveThresholdNotice(snapshot);
  return OkResponse(snapshot);
});
