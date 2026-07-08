import { z } from 'zod';
import createApiHandler from '@/core/api-handler';
import { OkResponse } from '@/core/responses';
import { runAccountabilityJob } from '@/services/accountability/jobs';

const bodySchema = z.object({
  job: z.enum(['quarterly-reminder', 'weekly-signoff-reminder', 'monthly-recap', 'm-plus-one-escalation']),
});

export const POST = createApiHandler({
  roles: ['service-account'],
  useServiceAccount: true,
  validations: { body: bodySchema },
})(async ({ body }) => {
  const result = await runAccountabilityJob(body.job);
  return OkResponse(result);
});
