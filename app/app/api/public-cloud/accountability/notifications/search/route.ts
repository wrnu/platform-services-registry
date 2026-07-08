import { GlobalPermissions } from '@/constants';
import createApiHandler from '@/core/api-handler';
import { OkResponse } from '@/core/responses';
import { searchAccountabilityNotifications } from '@/services/db/accountability-notifications';
import { accountabilityNotificationSearchBodySchema } from '@/validation-schemas';

export const POST = createApiHandler({
  permissions: [GlobalPermissions.ViewPublicCloudAccountability],
  validations: { body: accountabilityNotificationSearchBodySchema },
})(async ({ body }) => {
  const { data, totalCount } = await searchAccountabilityNotifications(body);
  return OkResponse({ data, totalCount });
});
