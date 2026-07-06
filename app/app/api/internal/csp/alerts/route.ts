import createApiHandler from '@/core/api-handler';
import { OkResponse } from '@/core/responses';
import { sendConsumptionAlertEmails } from '@/services/ches/public-cloud/accountability-emails';
import { recordConsumptionAlert } from '@/services/db/public-cloud-accountability';
import { cspConsumptionAlertSchema } from '@/validation-schemas/cloud-cost';

export const POST = createApiHandler({
  roles: ['service-account'],
  useServiceAccount: true,
  validations: { body: cspConsumptionAlertSchema },
})(async ({ body }) => {
  const alert = await recordConsumptionAlert(body);
  await sendConsumptionAlertEmails(body);
  return OkResponse(alert);
});
