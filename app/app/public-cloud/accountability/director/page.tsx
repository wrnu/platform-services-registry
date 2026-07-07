import { redirect } from 'next/navigation';

// Consolidated into the main accountability dashboard as the "Needs action" preset.
export default function DirectorRedirect() {
  redirect('/public-cloud/accountability/all?preset=needs-action');
}
