'use client';

import { Alert } from '@mantine/core';

export default function AccountabilityGuidancePanel() {
  return (
    <Alert color="blue" variant="light" title="Accountability expectations">
      <ul className="text-sm list-disc pl-5 space-y-1">
        <li>
          Maintain a rolling <strong>24-month</strong> forecast (April–March fiscal years). Empty future months mark the
          forecast as incomplete.
        </li>
        <li>
          Each quarter (Jan, Apr, Jul, Oct), extend months 13–24, review the full forecast, confirm team members, review
          past three months of spend, and obtain PO sign-off.
        </li>
        <li>
          When spend exceeds forecast, <strong>A1/A2/A3 alerts</strong> require an overage explanation and forecast
          update. Unresolved alerts may escalate to directors after M+1.
        </li>
        <li>
          Significant forecast increases require a justification and one-time vs ongoing classification when saving.
        </li>
      </ul>
    </Alert>
  );
}
