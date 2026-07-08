import prisma from '@/core/prisma';
import { parsePaginationParams } from '@/helpers/pagination';
import { Prisma } from '@/prisma/client';

export type RecordNotificationInput = {
  licencePlate?: string | null;
  templateKey: string;
  scenario?: string | null;
  subject: string;
  recipients: string[];
  cc?: string[];
  status: 'sent' | 'failed' | 'skipped_no_recipients';
  metadata?: Record<string, unknown> | null;
};

export function billingPeriodScenario(year: number, month: number) {
  return `billing:${year}-${month}`;
}

export async function recordAccountabilityNotification(input: RecordNotificationInput) {
  return prisma.accountabilityNotificationLog.create({
    data: {
      licencePlate: input.licencePlate ?? null,
      templateKey: input.templateKey,
      scenario: input.scenario ?? null,
      subject: input.subject,
      recipients: input.recipients,
      cc: input.cc ?? [],
      status: input.status,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function hasAccountabilityNotificationForScenario(
  licencePlate: string,
  templateKey: string,
  scenario: string,
) {
  const existing = await prisma.accountabilityNotificationLog.findFirst({
    where: { licencePlate, templateKey, scenario, status: 'sent' },
  });
  return !!existing;
}

export async function listAccountabilityNotifications(licencePlate: string, take = 20) {
  return prisma.accountabilityNotificationLog.findMany({
    where: { licencePlate },
    orderBy: { sentAt: 'desc' },
    take,
  });
}

export async function searchAccountabilityNotifications(body: {
  licencePlate?: string;
  templateKey?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { skip, take } = parsePaginationParams(body.page ?? 1, body.pageSize ?? 20, 20);
  const where: Prisma.AccountabilityNotificationLogWhereInput = {};

  if (body.licencePlate) where.licencePlate = body.licencePlate;
  if (body.templateKey) where.templateKey = body.templateKey;
  if (body.search?.trim()) {
    const term = body.search.trim();
    where.OR = [
      { subject: { contains: term, mode: 'insensitive' } },
      { licencePlate: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [data, totalCount] = await Promise.all([
    prisma.accountabilityNotificationLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take,
    }),
    prisma.accountabilityNotificationLog.count({ where }),
  ]);

  return { data, totalCount };
}
