import { AccountabilityAlertLevel, AccountabilityStatus, Prisma, Provider } from '@/prisma/client';

export const accountabilitySorts = [
  { label: 'Licence plate (A–Z)', sortKey: 'licencePlate', sortOrder: Prisma.SortOrder.asc },
  { label: 'Licence plate (Z–A)', sortKey: 'licencePlate', sortOrder: Prisma.SortOrder.desc },
  { label: 'Product name (A–Z)', sortKey: 'name', sortOrder: Prisma.SortOrder.asc },
  { label: 'Product name (Z–A)', sortKey: 'name', sortOrder: Prisma.SortOrder.desc },
  { label: 'Status', sortKey: 'status', sortOrder: Prisma.SortOrder.asc },
];

export const accountabilityStatusOptions = [
  { label: 'All statuses', value: 'all' },
  ...Object.values(AccountabilityStatus).map((status) => ({
    label: status.replace(/_/g, ' '),
    value: status,
  })),
];

export const accountabilityAlertLevelOptions = [
  { label: 'All alert levels', value: 'all' },
  ...Object.values(AccountabilityAlertLevel).map((level) => ({
    label: level,
    value: level,
  })),
];

export const accountabilityProviderOptions = [
  { label: 'All providers', value: 'all' },
  { label: 'AWS', value: Provider.AWS },
  { label: 'AWS LZA', value: Provider.AWS_LZA },
  { label: 'Azure', value: Provider.AZURE },
];

/** Statuses that require PO/TL or reviewer action (the former director view). */
export const accountabilityActionStatuses: AccountabilityStatus[] = [
  AccountabilityStatus.ESCALATED,
  AccountabilityStatus.FORECAST_REVIEW_REQUIRED,
  AccountabilityStatus.VARIANCE_REVIEW_REQUIRED,
  AccountabilityStatus.FORECAST_REQUIRED,
];

export type AccountabilityPreset = 'all' | 'needs-action' | 'escalation';

export const accountabilityPresetOptions: { label: string; value: AccountabilityPreset }[] = [
  { label: 'All projects', value: 'all' },
  { label: 'Needs action', value: 'needs-action' },
  { label: 'Escalation list', value: 'escalation' },
];
