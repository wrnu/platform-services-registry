import { proxy } from 'valtio';
import { AccountabilityPreset, accountabilityActionStatuses } from '@/constants/accountability';
import { PublicCloudAccountabilitySearchBody } from '@/validation-schemas';

export const pageState = proxy<PublicCloudAccountabilitySearchBody & { preset: AccountabilityPreset }>({
  preset: 'all',
  page: 1,
  pageSize: 10,
  search: '',
  sortValue: 'Licence plate (A–Z)',
});

export function applyPreset(preset: AccountabilityPreset) {
  pageState.preset = preset;
  pageState.page = 1;
  pageState.statuses = preset === 'needs-action' ? accountabilityActionStatuses : undefined;
  pageState.onEscalationList = preset === 'escalation' ? true : undefined;
}
