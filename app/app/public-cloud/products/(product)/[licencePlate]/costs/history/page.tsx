'use client';

import { Alert, Button } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import LoadingBox from '@/components/generic/LoadingBox';
import { getProviderSpendLabel } from '@/components/public-cloud/accountability/forecast-grid-utils';
import HistoricalSpendPanel from '@/components/public-cloud/costs/HistoricalSpendPanel';
import { GlobalRole } from '@/constants';
import createClientPage from '@/core/client-page';
import { getPublicCloudProductCosts } from '@/services/backend/public-cloud/costs';
import { usePublicProductState } from '@/states/global';

const historicalSpendPage = createClientPage({
  roles: [GlobalRole.User],
});

export default historicalSpendPage(() => {
  const params = useParams();
  const licencePlate = (params?.licencePlate as string) ?? '';
  const [, productSnap] = usePublicProductState();
  const product = productSnap.currentProduct;
  const spendLabel = getProviderSpendLabel(product?.provider);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['productCosts', licencePlate],
    queryFn: () => getPublicCloudProductCosts(licencePlate),
    enabled: !!licencePlate,
  });

  if (!licencePlate) {
    return null;
  }

  return (
    <LoadingBox isLoading={isLoading}>
      {isError ? (
        <Alert color="red" title="Could not load spend history">
          Failed to load historical spend. Try refreshing the page.
        </Alert>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{spendLabel} — historical</h1>
              <p className="text-sm text-gray-600 mt-1">
                Closed-month actuals since project inception for {licencePlate}.
              </p>
            </div>
            <Button component={Link} href={`/public-cloud/products/${licencePlate}/costs`} variant="light">
              Back to current month
            </Button>
          </div>

          <HistoricalSpendPanel
            months={data?.spendHistory?.months ?? []}
            provider={product?.provider}
            title={`${spendLabel} since inception`}
            showInceptionSummary
          />
        </div>
      )}
    </LoadingBox>
  );
});
