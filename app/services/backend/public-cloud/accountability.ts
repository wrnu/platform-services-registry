import axios from 'axios';
import { accountabilitySorts } from '@/constants/accountability';
import { Prisma } from '@/prisma/client';
import { downloadFile } from '@/utils/browser';
import { instance as parentInstance } from './instance';

export const instance = axios.create({
  ...parentInstance.defaults,
  baseURL: `${parentInstance.defaults.baseURL}/products`,
});

export async function getPublicCloudAccountability(licencePlate: string) {
  return instance.get(`/${licencePlate}/accountability`).then((res) => res.data);
}

export async function createPublicCloudForecast(
  licencePlate: string,
  data?: { monthlyValues?: unknown[]; horizonMonths?: number },
) {
  return instance.post(`/${licencePlate}/forecasts`, data ?? {}).then((res) => res.data);
}

export async function submitPublicCloudForecast(licencePlate: string, forecastId: string) {
  return instance.post(`/${licencePlate}/forecasts/${forecastId}/submit`).then((res) => res.data);
}

export async function approvePublicCloudForecast(licencePlate: string, forecastId: string) {
  return instance.post(`/${licencePlate}/forecasts/${forecastId}/approve`).then((res) => res.data);
}

export async function rejectPublicCloudForecast(licencePlate: string, forecastId: string, rejectionReason: string) {
  return instance.post(`/${licencePlate}/forecasts/${forecastId}/reject`, { rejectionReason }).then((res) => res.data);
}

export async function acknowledgePublicCloudAlert(licencePlate: string, alertId: string, explanation?: string) {
  return instance.post(`/${licencePlate}/alerts/${alertId}/acknowledge`, { explanation }).then((res) => res.data);
}

export async function resolvePublicCloudAlert(
  licencePlate: string,
  alertId: string,
  resolutionReason: string,
  explanation?: string,
) {
  return instance
    .post(`/${licencePlate}/alerts/${alertId}/resolve`, { resolutionReason, explanation })
    .then((res) => res.data);
}

export async function signOffPublicCloudQuarterlyReview(licencePlate: string) {
  return instance.post(`/${licencePlate}/quarterly-review`).then((res) => res.data);
}

export async function updatePublicCloudQuarterlyReview(licencePlate: string, data: Record<string, boolean>) {
  return instance.put(`/${licencePlate}/quarterly-review`, data).then((res) => res.data);
}

export async function updatePublicCloudForecast(
  licencePlate: string,
  forecastId: string,
  data: {
    monthlyValues: { year: number; month: number; amount: number; currency: 'USD' | 'CAD' }[];
    horizonMonths: number;
    changeJustification?: string;
    changeNature?: 'ONE_TIME' | 'ONGOING';
  },
) {
  return instance.put(`/${licencePlate}/forecasts/${forecastId}`, data).then((res) => res.data);
}

export const adminInstance = axios.create({
  ...parentInstance.defaults,
  baseURL: `${parentInstance.defaults.baseURL}/accountability`,
});

export async function searchPublicCloudAccountability(data: Record<string, unknown>) {
  const reqData = { ...data };
  const selectedOption = accountabilitySorts.find((sort) => sort.label === reqData.sortValue);

  if (selectedOption) {
    reqData.sortKey = selectedOption.sortKey;
    reqData.sortOrder = selectedOption.sortOrder;
  } else {
    reqData.sortKey = 'licencePlate';
    reqData.sortOrder = Prisma.SortOrder.asc;
  }

  return adminInstance.post('/search', reqData).then((res) => res.data);
}

export async function downloadBundledAccountabilityExport(provider?: string, format: 'csv' | 'xlsx' = 'xlsx') {
  const result = await adminInstance.post('/export', { provider, format }, { responseType: 'blob' }).then((res) => {
    if (res.status === 204) return false;

    const suffix = provider ? provider.toLowerCase() : 'all';
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    downloadFile(res.data, `public-cloud-accountability-${suffix}.${ext}`, res.headers);
    return true;
  });

  return result;
}

export async function searchAccountabilityNotifications(data: Record<string, unknown>) {
  return adminInstance.post('/notifications/search', data).then((res) => res.data);
}

export async function getPlatformForecast() {
  return adminInstance.get('/forecast').then((res) => res.data);
}

export async function downloadPlatformForecastExport(format: 'csv' | 'xlsx' = 'xlsx') {
  const result = await adminInstance
    .get('/forecast/export', { params: { format }, responseType: 'blob' })
    .then((res) => {
      if (res.status === 204) return false;

      const ext = format === 'csv' ? 'csv' : 'xlsx';
      downloadFile(res.data, `public-cloud-forecast.${ext}`, res.headers);
      return true;
    });

  return result;
}
