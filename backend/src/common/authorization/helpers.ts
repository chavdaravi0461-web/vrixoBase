import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function requireProjectMembership(
  prisma: PrismaService,
  projectId: string,
  userId?: string,
): Promise<{ role: string }> {
  if (!userId) {
    throw new UnauthorizedException('Authentication required');
  }

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
  });

  if (!member) {
    throw new ForbiddenException('You are not a member of this project');
  }

  return { role: member.role };
}

export async function resolveBucketProjectId(
  prisma: PrismaService,
  bucketId: string,
): Promise<string> {
  const bucket = await prisma.bucket.findUnique({
    where: { id: bucketId },
    select: { projectId: true },
  });
  if (!bucket) throw new ForbiddenException('Bucket not found');
  return bucket.projectId;
}

export async function resolveFileProjectId(
  prisma: PrismaService,
  fileId: string,
): Promise<string> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: { bucket: { select: { projectId: true } } },
  });
  if (!file) throw new ForbiddenException('File not found');
  return file.bucket.projectId;
}
