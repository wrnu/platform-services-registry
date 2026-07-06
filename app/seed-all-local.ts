/**
 * Full local dev seed: ministries, users, cost rules, Azure product, accountability demo data.
 * Run: pnpm run seed-all-local [--reset]
 */
import prisma from './core/prisma';
import { AZURE_DEMO_PLATE, seedAzurePublicCloudProduct } from './seed/seed-azure-product';
import { seedFoundation } from './seed/seed-foundation';
import { seedAccountabilityForProduct } from './seed-accountability-local';

async function main() {
  const reset = process.argv.includes('--reset');

  console.log('=== Local full seed ===\n');

  console.log('1. Foundation (organizations, users, cost rules)...');
  await seedFoundation();

  console.log('\n2. Azure public cloud product...');
  await seedAzurePublicCloudProduct();

  console.log('\n3. Accountability demo data (CSP, forecast, alerts)...');
  await seedAccountabilityForProduct(AZURE_DEMO_PLATE, {
    reset,
    showWalkthrough: true,
  });

  console.log('\n=== Seed complete ===');
  console.log(`Login: admin.system@gov.bc.ca`);
  console.log(`Product: http://localhost:3000/public-cloud/products/${AZURE_DEMO_PLATE}/edit`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
