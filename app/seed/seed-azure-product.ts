import { defaultAccountCoding } from '../constants/public-cloud';
import prisma from '../core/prisma';
import { ProjectStatus, Provider, PublicCloudProductMemberRole } from '../prisma/client';

export const AZURE_DEMO_PLATE = 'e71b0e';
export const AZURE_DEMO_NAME = 'Cost Model Test 1';
export const AWS_DEMO_PLATE = 'f82c1a';
export const AWS_DEMO_NAME = 'Cost Model Test 2 (AWS)';

async function requireUser(email: string) {
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw new Error(`User ${email} not found. Run seed foundation first.`);
  }
  return user;
}

type DemoProductConfig = {
  licencePlate: string;
  name: string;
  provider: Provider;
  description: string;
  budget: { dev: number; test: number; prod: number; tools: number };
};

async function seedDemoPublicCloudProduct(config: DemoProductConfig) {
  const existing = await prisma.publicCloudProduct.findFirst({
    where: { licencePlate: config.licencePlate },
  });

  if (existing) {
    console.log(`  ${config.provider} product ${config.licencePlate} (${existing.name}) already exists — skipped`);
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

  const product = await prisma.publicCloudProduct.create({
    data: {
      licencePlate: config.licencePlate,
      name: config.name,
      description: config.description,
      status: ProjectStatus.ACTIVE,
      budget: config.budget,
      projectOwnerId: projectOwner.id,
      primaryTechnicalLeadId: primaryTechnicalLead.id,
      secondaryTechnicalLeadId: secondaryTechnicalLead.id,
      expenseAuthorityId: expenseAuthority.id,
      organizationId: org.id,
      provider: config.provider,
      requiresNetworking: false,
      networkingReason: '',
      providerSelectionReasons: ['Cost Efficiency'],
      providerSelectionReasonsNote: `Local development seed product (${config.provider}).`,
      environmentsEnabled,
      members: [
        { userId: projectOwner.id, roles: [PublicCloudProductMemberRole.EDITOR] },
        { userId: primaryTechnicalLead.id, roles: [PublicCloudProductMemberRole.EDITOR] },
        { userId: secondaryTechnicalLead.id, roles: [PublicCloudProductMemberRole.VIEWER] },
      ],
    },
  });

  const existingBilling = await prisma.publicCloudBilling.findFirst({
    where: { licencePlate: config.licencePlate },
  });

  if (!existingBilling) {
    await prisma.publicCloudBilling.create({
      data: {
        licencePlate: config.licencePlate,
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

  console.log(`  created ${config.provider} product ${config.licencePlate} — ${config.name}`);
  return product;
}

export async function seedAzurePublicCloudProduct() {
  return seedDemoPublicCloudProduct({
    licencePlate: AZURE_DEMO_PLATE,
    name: AZURE_DEMO_NAME,
    provider: Provider.AZURE,
    description: 'Local seed Azure product for accountability and cost testing.',
    budget: {
      dev: 12000,
      test: 10000,
      prod: 20000,
      tools: 5000,
    },
  });
}

export async function seedAwsPublicCloudProduct() {
  return seedDemoPublicCloudProduct({
    licencePlate: AWS_DEMO_PLATE,
    name: AWS_DEMO_NAME,
    provider: Provider.AWS,
    description: 'Local seed AWS product for accountability and cost testing (USD).',
    budget: {
      dev: 8000,
      test: 6000,
      prod: 15000,
      tools: 3000,
    },
  });
}
