/**
 * Full local dev seed: ministries, users, cost rules, Azure product, accountability demo data.
 * Run: pnpm run seed-all-local [--reset]
 */
import prisma from '../core/prisma';
import { seedAccountabilityForProduct } from './seed-accountability-local';
import {
  AWS_DEMO_PLATE,
  AZURE_DEMO_PLATE,
  seedAwsPublicCloudProduct,
  seedAzurePublicCloudProduct,
} from './seed-azure-product';
import { seedFoundation } from './seed-foundation';

async function main() {
  const reset = process.argv.includes('--reset');

  console.log('=== Local full seed ===\n');

  console.log('1. Foundation (organizations, users, cost rules)...');
  await seedFoundation();

  console.log('\n2. Azure public cloud product...');
  await seedAzurePublicCloudProduct();

  console.log('\n3. AWS public cloud product...');
  await seedAwsPublicCloudProduct();

  console.log('\n4. Accountability demo data (CSP, forecast, alerts)...');
  await seedAccountabilityForProduct(AZURE_DEMO_PLATE, {
    reset,
    showWalkthrough: true,
  });

  console.log('\n5. Accountability demo data for AWS product...');
  await seedAccountabilityForProduct(AWS_DEMO_PLATE, { reset });

  console.log('\n=== Seed complete ===');
  console.log(`Login: admin.system@gov.bc.ca`);
  console.log(`Azure product: http://localhost:3000/public-cloud/products/${AZURE_DEMO_PLATE}/edit`);
  console.log(`AWS product: http://localhost:3000/public-cloud/products/${AWS_DEMO_PLATE}/edit`);
  console.log(`Public Cloud Forecast: http://localhost:3000/public-cloud/accountability/forecast`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
