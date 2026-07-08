import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import PublicCloudLayout from '@/emails/_components/layout/PublicCloudLayout';
import LinkButton from '@/emails/_components/LinkButton';

interface ChecklistProps {
  forecastMonthsAdded: boolean;
  forecastMonthsReviewed: boolean;
  membersReviewed: boolean;
  spendLookbackReviewed: boolean;
  softQrCompleted: boolean;
  poSignedOff: boolean;
}

interface EmailProps {
  productName: string;
  licencePlate: string;
  quarter: number;
  fiscalYear: number;
  daysUntilMPlusOne: number;
  checklist: ChecklistProps;
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <Text>
      {done ? '✓' : '○'} {label}
    </Text>
  );
}

export default function QuarterlySignOffReminder({
  productName,
  licencePlate,
  quarter,
  fiscalYear,
  daysUntilMPlusOne,
  checklist,
}: EmailProps) {
  return (
    <PublicCloudLayout requester="Public Cloud Team" showFooter>
      <Heading className="text-lg">
        Quarterly sign-off reminder — Q{quarter} {fiscalYear}
      </Heading>
      <Text>Hi Project Owner,</Text>
      <Text>
        Quarterly accountability for <strong>{productName}</strong> ({licencePlate}) is still incomplete.
      </Text>
      <Text>Outstanding checklist items:</Text>
      <ChecklistItem done={checklist.forecastMonthsAdded} label="Extend forecast months 13–24" />
      <ChecklistItem done={checklist.forecastMonthsReviewed} label="Review 24-month forecast" />
      <ChecklistItem done={checklist.membersReviewed} label="Review team members" />
      <ChecklistItem done={checklist.spendLookbackReviewed} label="Review past three months of spend" />
      <ChecklistItem done={checklist.softQrCompleted} label="Complete soft quarterly review" />
      <ChecklistItem done={checklist.poSignedOff} label="PO sign-off" />
      {daysUntilMPlusOne > 0 && (
        <Text>
          If sign-off is not completed within <strong>{daysUntilMPlusOne} days</strong>, the project may be escalated to
          Director / Executive Director visibility.
        </Text>
      )}
      <LinkButton href={`/public-cloud/products/${licencePlate}/edit`}>Complete quarterly review</LinkButton>
    </PublicCloudLayout>
  );
}
