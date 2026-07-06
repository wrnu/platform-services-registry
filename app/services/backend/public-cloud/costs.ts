import axios from 'axios';
import { instance as parentInstance } from './instance';

export const instance = axios.create({
  ...parentInstance.defaults,
  baseURL: `${parentInstance.defaults.baseURL}/products`,
});

export async function getPublicCloudProductCosts(licencePlate: string) {
  return instance.get(`/${licencePlate}/costs`).then((res) => res.data);
}
