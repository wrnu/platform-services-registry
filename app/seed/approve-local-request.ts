/**
 * Approve pending public cloud CREATE requests and provision products locally.
 * Run: pnpm run approve-local-request
 */
import prisma from '../core/prisma';
import {
  DecisionStatus,
  ProjectStatus,
  PublicCloudRequestData,
  RequestType,
  TaskStatus,
  TaskType,
} from '../prisma/client';

function productFieldsFromDecisionData(data: PublicCloudRequestData) {
  return {
    licencePlate: data.licencePlate,
    name: data.name,
    description: data.description,
    status: ProjectStatus.ACTIVE,
    budget: data.budget,
    projectOwnerId: data.projectOwnerId,
    primaryTechnicalLeadId: data.primaryTechnicalLeadId,
    secondaryTechnicalLeadId: data.secondaryTechnicalLeadId,
    expenseAuthorityId: data.expenseAuthorityId,
    organizationId: data.organizationId,
    provider: data.provider,
    requiresNetworking: data.requiresNetworking,
    networkingReason: data.networkingReason,
    providerSelectionReasons: data.providerSelectionReasons,
    providerSelectionReasonsNote: data.providerSelectionReasonsNote,
    environmentsEnabled: data.environmentsEnabled,
    members: data.members,
  };
}

async function main() {
  const reviewer =
    (await prisma.user.findFirst({ where: { email: 'public.reviewer.system@gov.bc.ca' } })) ??
    (await prisma.user.findFirst({ where: { email: 'admin.system@gov.bc.ca' } }));

  if (!reviewer) {
    throw new Error('No reviewer user found. Run pnpm run seed-local first.');
  }

  const pending = await prisma.publicCloudRequest.findMany({
    where: {
      active: true,
      decisionStatus: DecisionStatus.PENDING,
      type: RequestType.CREATE,
    },
    include: { decisionData: true },
  });

  if (!pending.length) {
    console.log('No pending public cloud create requests.');
    return;
  }

  for (const request of pending) {
    const productData = productFieldsFromDecisionData(request.decisionData);

    await prisma.publicCloudRequest.update({
      where: { id: request.id },
      data: {
        decisionStatus: DecisionStatus.APPROVED,
        decisionDate: new Date(),
        decisionMakerId: reviewer.id,
      },
    });

    const closedTasks = await prisma.task.updateMany({
      where: {
        type: TaskType.REVIEW_PUBLIC_CLOUD_REQUEST,
        status: { in: [TaskStatus.ASSIGNED, TaskStatus.STARTED] },
        data: { equals: { requestId: request.id, licencePlate: request.licencePlate } },
      },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: reviewer.id,
        closedMetadata: { decision: DecisionStatus.APPROVED },
      },
    });

    const product = await prisma.publicCloudProduct.upsert({
      where: { licencePlate: request.licencePlate },
      update: productData,
      create: productData,
    });

    await prisma.publicCloudRequest.update({
      where: { id: request.id },
      data: {
        decisionStatus: DecisionStatus.PROVISIONED,
        provisionedDate: new Date(),
        active: false,
        projectId: product.id,
      },
    });

    console.log(
      `  ${request.licencePlate} (${request.decisionData.name}): approved, provisioned, closed ${closedTasks.count} review task(s)`,
    );
  }

  console.log(`\nProvisioned ${pending.length} request(s). Refresh the requests list.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
