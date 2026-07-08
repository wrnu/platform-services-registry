'use client';

type TeamPerson = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

function formatName(person?: TeamPerson | null) {
  if (!person) return '—';
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
  return name || person.email || '—';
}

export default function AccountabilityTeamSummary({
  projectOwner,
  primaryTechnicalLead,
  secondaryTechnicalLead,
}: {
  projectOwner?: TeamPerson | null;
  primaryTechnicalLead?: TeamPerson | null;
  secondaryTechnicalLead?: TeamPerson | null;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-3 text-sm">
      <div>
        <dt className="text-gray-500">Project owner</dt>
        <dd className="font-medium">{formatName(projectOwner)}</dd>
        {projectOwner?.email && <dd className="text-gray-600 text-xs">{projectOwner.email}</dd>}
      </div>
      <div>
        <dt className="text-gray-500">Primary technical lead</dt>
        <dd className="font-medium">{formatName(primaryTechnicalLead)}</dd>
        {primaryTechnicalLead?.email && <dd className="text-gray-600 text-xs">{primaryTechnicalLead.email}</dd>}
      </div>
      <div>
        <dt className="text-gray-500">Secondary technical lead</dt>
        <dd className="font-medium">{formatName(secondaryTechnicalLead)}</dd>
        {secondaryTechnicalLead?.email && <dd className="text-gray-600 text-xs">{secondaryTechnicalLead.email}</dd>}
      </div>
    </dl>
  );
}
