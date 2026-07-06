'use client';

import { Alert } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import LoadingBox from '@/components/generic/LoadingBox';
import CurrentMonthSpendPanel from '@/components/public-cloud/costs/CurrentMonthSpendPanel';
import { GlobalRole } from '@/constants';
import createClientPage from '@/core/client-page';
import { getPublicCloudProductCosts } from '@/services/backend/public-cloud/costs';
import { usePublicProductState } from '@/states/global';

const publicCloudProductCosts = createClientPage({
  roles: [GlobalRole.User],
});

export default publicCloudProductCosts(() => {
  const params = useParams();
  const licencePlate = (params?.licencePlate as string) ?? '';
  const [, productSnap] = usePublicProductState();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['productCosts', licencePlate],
    queryFn: () => getPublicCloudProductCosts(licencePlate),
    enabled: !!licencePlate,
  });

  if (!licencePlate) {
    return null;
  }

  if (isLoading) {
    return (
      <LoadingBox isLoading>
        <div className="min-h-48" />
      </LoadingBox>
    );
  }

  if (isError) {
    return (
      <Alert color="red" title="Could not load costs">
        Failed to load current month spend. Try refreshing the page.
      </Alert>
    );
  }

  const canViewAccountability = productSnap.currentProduct?._permissions?.viewAccountability;

  return (
    <div className="space-y-6">
      <CurrentMonthSpendPanel
        snapshot={data?.snapshot ?? null}
        billingPeriod={data?.billingPeriod}
        title="Current month cloud spend"
        showTotalHighlight
      />
      {canViewAccountability && (
        <p className="text-sm text-gray-600">
          Forecasts, alerts, and quarterly review are on the{' '}
          <Link href={`/public-cloud/products/${licencePlate}/edit`} className="underline text-blue-600 font-medium">
            Product
          </Link>{' '}
          tab under Project budget and spend forecast.
        </p>
      )}
    </div>
  );
});
