'use client';

import { useSnapshot } from 'valtio';
import LoadingBox from '@/components/generic/LoadingBox';
import FormSingleSelect from '@/components/generic/select/FormSingleSelect';
import {
  accountabilityAlertLevelOptions,
  accountabilityProviderOptions,
  accountabilityStatusOptions,
} from '@/constants/accountability';
import { AccountabilityStatus } from '@/prisma/client';
import { pageState } from './state';

export default function FilterPanel({ isLoading = false }: { isLoading?: boolean }) {
  const snap = useSnapshot(pageState);

  return (
    <LoadingBox isLoading={isLoading}>
      <div className="grid grid-cols-1 gap-y-2 md:grid-cols-12 md:gap-x-3">
        <div className="col-span-4">
          <FormSingleSelect
            name="status"
            value={snap.status ?? 'all'}
            data={accountabilityStatusOptions}
            onChange={(value) => {
              pageState.status = value === 'all' ? undefined : (value as AccountabilityStatus);
              pageState.page = 1;
            }}
          />
        </div>
        <div className="col-span-4">
          <FormSingleSelect
            name="alertLevel"
            value={snap.highestOpenAlert ?? 'all'}
            data={accountabilityAlertLevelOptions}
            onChange={(value) => {
              pageState.highestOpenAlert = value === 'all' ? undefined : (value as typeof snap.highestOpenAlert);
              pageState.page = 1;
            }}
          />
        </div>
        <div className="col-span-4">
          <FormSingleSelect
            name="provider"
            value={snap.provider ?? 'all'}
            data={accountabilityProviderOptions}
            onChange={(value) => {
              pageState.provider = value === 'all' ? undefined : (value as typeof snap.provider);
              pageState.page = 1;
            }}
          />
        </div>
      </div>
    </LoadingBox>
  );
}
