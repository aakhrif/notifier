import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createEmailJob({ resources, tokens, interval, email, template }: {
  resources: string[];
  tokens: string[];
  interval: number;
  email: string;
  template: string;
}) {
  return prisma.emailJob.create({
    data: {
      resources: JSON.stringify(resources),
      tokens: JSON.stringify(tokens),
      interval,
      email,
      template,
      status: 'active',
    },
  });
}

export async function getActiveEmailJobs() {
  return prisma.emailJob.findMany({ where: { status: 'active' } });
}

export async function updateEmailJobStatus(id: string, status: string) {
  return prisma.emailJob.update({ where: { id }, data: { status } });
}

export async function deleteEmailJob(id: string) {
  return prisma.emailJob.delete({ where: { id } });
}
