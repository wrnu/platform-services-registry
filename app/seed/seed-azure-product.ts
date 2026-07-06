import { defaultAccountCoding } from '../constants/public-cloud';
import prisma from '../core/prisma';
import { ProjectStatus, Provider, PublicCloudProductMemberRole } from '../prisma/client';

export const AZURE_DEMO_PLATE = 'e71b0e';
export const AZURE_DEMO_NAME = 'Cost Model Test 1';

async function requireUser(email: string) {
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw new Error(`User ${email} not found. Run seed foundation first.`);
  }
  return user;
}

export async function seedAzurePublicCloudProduct() {
  const existing = await prisma.publicCloudProduct.findFirst({
    where: { licencePlate: AZURE_DEMO_PLATE },
  });

  if (existing) {
    console.log(`  Azure product ${AZURE_DEMO_PLATE} (${existing.name}) already exists — skipped`);
    return existing;
  }

  const org = await prisma.organization.findFirst({ orderBy: { code: 'asc' } });
  if (!org) {
    throw new Error('No organization found. Run seed foundation first.');
  }

  const projectOwner = await requireUser('john.doe@gov.bc.ca');
  const primaryTechnicalLead = await requireUser('james.smith@gov.bc.ca');
  const secondaryTechnicalLead = await requireUser('sarah.williams@gov.bc.ca');
  const expenseAuthority = await requireUser('david.johnson@gov.bc.ca');
  const billingReviewer =
    (await prisma.user.findFirst({ where: { email: 'billing.reviewer.system@gov.bc.ca' } })) ?? expenseAuthority;

  const environmentsEnabled = {
    production: true,
    productionRequiresNetworking: false,
    test: true,
    testRequiresNetworking: false,
    development: true,
    developmentRequiresNetworking: false,
    tools: true,
    toolsRequiresNetworking: false,
  };

  const budget = {
    dev: 12000,
    test: 10000,
    prod: 20000,
    tools: 5000,
  };

  const product = await prisma.publicCloudProduct.create({
    data: {
      licencePlate: AZURE_DEMO_PLATE,
      name: AZURE_DEMO_NAME,
      description: 'Local seed Azure product for accountability and cost testing.',
      status: ProjectStatus.ACTIVE,
      budget,
      projectOwnerId: projectOwner.id,
      primaryTechnicalLeadId: primaryTechnicalLead.id,
      secondaryTechnicalLeadId: secondaryTechnicalLead.id,
      expenseAuthorityId: expenseAuthority.id,
      organizationId: org.id,
      provider: Provider.AZURE,
      requiresNetworking: false,
      networkingReason: '',
      providerSelectionReasons: ['Cost Efficiency'],
      providerSelectionReasonsNote: 'Local development seed product (Azure).',
      environmentsEnabled,
      members: [
        { userId: projectOwner.id, roles: [PublicCloudProductMemberRole.EDITOR] },
        { userId: primaryTechnicalLead.id, roles: [PublicCloudProductMemberRole.EDITOR] },
        { userId: secondaryTechnicalLead.id, roles: [PublicCloudProductMemberRole.VIEWER] },
      ],
    },
  });

  const existingBilling = await prisma.publicCloudBilling.findFirst({
    where: { licencePlate: AZURE_DEMO_PLATE },
  });

  if (!existingBilling) {
    await prisma.publicCloudBilling.create({
      data: {
        licencePlate: AZURE_DEMO_PLATE,
        expenseAuthorityId: expenseAuthority.id,
        accountCoding: defaultAccountCoding,
        signed: true,
        signedAt: new Date(),
        signedById: expenseAuthority.id,
        approved: true,
        approvedAt: new Date(),
        approvedById: billingReviewer.id,
      },
    });
  }

  console.log(`  created Azure product ${AZURE_DEMO_PLATE} — ${AZURE_DEMO_NAME}`);
  return product;
}
