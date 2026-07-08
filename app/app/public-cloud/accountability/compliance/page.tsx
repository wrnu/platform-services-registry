import { redirect } from 'next/navigation';

// Consolidated into the main accountability dashboard as the "Escalation list"
// preset. Email templates link here, so keep this route as a stable redirect.
export default function ComplianceRedirect() {
  redirect('/public-cloud/accountability/all?preset=escalation');
}
