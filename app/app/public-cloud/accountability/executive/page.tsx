import { redirect } from 'next/navigation';

// Consolidated into the main accountability dashboard (KPI cards + full portfolio).
export default function ExecutiveRedirect() {
  redirect('/public-cloud/accountability/all');
}
