'use client';

import { Badge } from '@mantine/core';

type EnvironmentsEnabled = {
  development?: boolean;
  test?: boolean;
  production?: boolean;
  tools?: boolean;
};

const envLabels: { key: keyof EnvironmentsEnabled; label: string }[] = [
  { key: 'development', label: 'Development' },
  { key: 'test', label: 'Test' },
  { key: 'production', label: 'Production' },
  { key: 'tools', label: 'Tools' },
];

export default function AccountabilityAccountsSummary({
  environmentsEnabled,
}: {
  environmentsEnabled?: EnvironmentsEnabled | null;
}) {
  const enabled = envLabels.filter(({ key }) => environmentsEnabled?.[key]);

  if (!enabled.length) {
    return <p className="text-sm text-gray-600">No environments enabled.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {enabled.map(({ key, label }) => (
        <Badge key={key} variant="light" color="gray" size="lg">
          {label}
        </Badge>
      ))}
    </div>
  );
}
