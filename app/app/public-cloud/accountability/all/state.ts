import { proxy } from 'valtio';
import { PublicCloudAccountabilitySearchBody } from '@/validation-schemas';

export const pageState = proxy<PublicCloudAccountabilitySearchBody>({
  page: 1,
  pageSize: 10,
  search: '',
  sortValue: 'Licence plate (A–Z)',
});
