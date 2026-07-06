import axios from 'axios';
import { CloudCostRulesConfigBody } from '@/validation-schemas';
import { instance as baseInstance } from '../axios';

export const instance = axios.create({
  ...baseInstance.defaults,
  baseURL: `${baseInstance.defaults.baseURL}/admin/public-cloud/cost-rules`,
});

export async function getCloudCostRulesConfig() {
  return instance.get('').then((res) => res.data);
}

export async function createCloudCostRulesConfig(data: CloudCostRulesConfigBody) {
  return instance.post('/create', data).then((res) => res.data);
}

export async function previewCloudCostRules(data: {
  forecastAmount: number;
  spendToDate: number;
  dayOfMonth?: number;
  rules?: CloudCostRulesConfigBody;
}) {
  return instance.post('/preview', data).then((res) => res.data);
}
