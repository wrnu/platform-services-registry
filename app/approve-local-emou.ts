/**
 * Approve signed eMOUs locally (skips billing reviewer UI).
 * Run: pnpm run approve-local-emou
 */
import prisma from './core/prisma';
import { RequestType, TaskStatus, TaskType } from './prisma/client';

async function main() {
  const reviewer =
    (await prisma.user.findFirst({ where: { email: 'billing.reviewer.system@gov.bc.ca' } })) ??
    (await prisma.user.findFirst({ where: { email: 'admin.system@gov.bc.ca' } }));

  if (!reviewer) {
    throw new Error('No reviewer user found. Run pnpm run seed-local first.');
  }

  const pending = await prisma.publicCloudBilling.findMany({
    where: { signed: true, approved: false },
  });

  if (!pending.length) {
    console.log('No signed billings waiting for review.');
    return;
  }

  for (const billing of pending) {
    await prisma.publicCloudBilling.update({
      where: { id: billing.id },
      data: {
        approved: true,
        approvedAt: new Date(),
        approvedById: reviewer.id,
      },
    });

    const closed = await prisma.task.updateMany({
      where: {
        type: TaskType.REVIEW_PUBLIC_CLOUD_MOU,
        status: { in: [TaskStatus.ASSIGNED, TaskStatus.STARTED] },
        data: { equals: { licencePlate: billing.licencePlate } },
      },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: reviewer.id,
        closedMetadata: { decision: 'APPROVE' },
      },
    });

    const createRequest = await prisma.publicCloudRequest.findFirst({
      where: { licencePlate: billing.licencePlate, type: RequestType.CREATE, active: true },
    });

    if (createRequest) {
      const existingReviewTask = await prisma.task.findFirst({
        where: {
          type: TaskType.REVIEW_PUBLIC_CLOUD_REQUEST,
          status: { in: [TaskStatus.ASSIGNED, TaskStatus.STARTED] },
          data: { equals: { licencePlate: billing.licencePlate } },
        },
      });

      if (!existingReviewTask) {
        await prisma.task.create({
          data: {
            type: TaskType.REVIEW_PUBLIC_CLOUD_REQUEST,
            status: TaskStatus.ASSIGNED,
            roles: ['public-reviewer'],
            data: { licencePlate: billing.licencePlate, requestId: createRequest.id },
          },
        });
        console.log(`  ${billing.licencePlate}: eMOU approved; create-request review task added`);
      } else {
        console.log(`  ${billing.licencePlate}: eMOU approved`);
      }
    } else {
      console.log(`  ${billing.licencePlate}: eMOU approved`);
    }

    console.log(`  closed ${closed.count} REVIEW_PUBLIC_CLOUD_MOU task(s)`);
  }

  console.log(`\nApproved ${pending.length} billing eMOU(s). Refresh the billing page.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
