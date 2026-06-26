import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface AuditQuery {
  action?: string;
  userId?: string;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    projectId: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ip?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: JSON.stringify(params.metadata ?? {}),
        ipAddress: params.ip,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async getLogs(projectId: string, query: AuditQuery) {
    const where: Record<string, unknown> = { projectId };

    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    if (query.entity) where.entity = query.entity;

    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.gte = new Date(query.from);
      if (query.to) createdAt.lte = new Date(query.to);
      where.createdAt = createdAt;
    }

    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getLog(projectId: string, id: string) {
    const log = await this.prisma.auditLog.findFirst({
      where: { id, projectId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
    if (!log) throw new NotFoundException('Audit log entry not found');
    return log;
  }
}
