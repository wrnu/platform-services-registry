'use client';

import { Checkbox } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { updatePublicCloudQuarterlyReview } from '@/services/backend/public-cloud/accountability';

type QuarterlyReview = {
  forecastMonthsAdded: boolean;
  forecastMonthsReviewed: boolean;
  membersReviewed: boolean;
  spendLookbackReviewed: boolean;
  softQrCompleted: boolean;
  poSignedOff: boolean;
};

const checklistItems: {
  key: keyof Omit<QuarterlyReview, 'poSignedOff'>;
  label: string;
}[] = [
  { key: 'forecastMonthsAdded', label: 'Months 13–24 added' },
  { key: 'forecastMonthsReviewed', label: '24-month forecast reviewed' },
  { key: 'membersReviewed', label: 'Team members reviewed' },
  { key: 'spendLookbackReviewed', label: 'Past 3 months spend reviewed' },
  { key: 'softQrCompleted', label: 'Soft quarterly review complete' },
];

export default function AccountabilityQuarterlyChecklist({
  licencePlate,
  review,
  editable,
  onUpdated,
}: {
  licencePlate: string;
  review: QuarterlyReview;
  editable: boolean;
  onUpdated: () => void;
}) {
  const update = useMutation({
    mutationFn: (data: Record<string, boolean>) => updatePublicCloudQuarterlyReview(licencePlate, data),
    onSuccess: onUpdated,
  });

  return (
    <ul className="space-y-2">
      {checklistItems.map(({ key, label }) => (
        <li key={key}>
          <Checkbox
            checked={review[key]}
            disabled={!editable || update.isPending}
            label={label}
            onChange={(e) => update.mutate({ [key]: e.currentTarget.checked })}
          />
        </li>
      ))}
      <li className="text-sm text-gray-600">PO sign-off: {review.poSignedOff ? 'Yes' : 'No'}</li>
    </ul>
  );
}
