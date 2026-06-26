import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

type PrismaUniqueConstraintError = {
  code?: string;
  meta?: {
    target?: string[] | string;
  };
};

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto, userId: string) {
    const existing = await this.prisma.project.findFirst({
      where: {
        members: { some: { userId } },
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException('You already have a project with this name');
    }

    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const slugConflict = await this.prisma.project.findUnique({
      where: { slug },
    });

    if (slugConflict) {
      throw new ConflictException('A project with this slug already exists');
    }

    let project;

    try {
      project = await this.prisma.project.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          region: dto.region ?? 'us-east-1',
          plan: dto.plan as any ?? 'FREE',
          createdById: userId,
          members: {
            create: {
              userId,
              role: 'admin',
            },
          },
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error, 'slug')) {
        throw new ConflictException('A project with this slug already exists');
      }
      throw error;
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'create',
        entity: 'project',
        entityId: project.id,
        projectId: project.id,
        userId,
      },
    });

    return project;
  }

  private isUniqueConstraintError(error: unknown, field: string) {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const prismaError = error as PrismaUniqueConstraintError;
    if (prismaError.code !== 'P2002') {
      return false;
    }

    const target = prismaError.meta?.target;
    return Array.isArray(target) ? target.includes(field) : target === field;
  }

  async list(userId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m: any) => ({
      ...m.project,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async get(id: string, userId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true, avatarUrl: true } },
          },
        },
        _count: {
          select: {
            functions: true,
            apiKeys: true,
          },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    if (userId) {
      const isMember = project.members.some((m: any) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException('You are not a member of this project');
      }
    }

    return project;
  }

  async update(id: string, dto: Partial<CreateProjectDto>, userId?: string) {
    await this.get(id, userId);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.region !== undefined && { region: dto.region as any }),
        ...(dto.plan !== undefined && { plan: dto.plan as any }),
      },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          action: 'update',
          entity: 'project',
          entityId: id,
          projectId: id,
          userId,
          metadata: JSON.stringify({ changes: Object.keys(dto) }),
        },
      });
    }

    return updated;
  }

  async delete(id: string, userId?: string) {
    await this.get(id, userId);

    await this.prisma.project.delete({ where: { id } });

    this.logger.log(`Project ${id} deleted`);
  }

  async getStats(id: string, userId?: string) {
    await this.get(id, userId);

    const [
      functionCount,
      memberCount,
      executionCount,
      recentMetrics,
    ] = await Promise.all([
      this.prisma.function.count({ where: { projectId: id } }),
      this.prisma.projectMember.count({ where: { projectId: id } }),
      this.prisma.functionExecution.count({
        where: { function: { projectId: id } },
      }),
      this.prisma.usageMetric.findMany({
        where: { projectId: id },
        orderBy: { recordedAt: 'desc' },
        take: 100,
      }),
    ]);

    const totalExecutions = executionCount;

    const metricsMap: Record<string, { value: number; unit: string }[]> = {};
    for (const m of recentMetrics) {
      if (!metricsMap[m.metric]) metricsMap[m.metric] = [];
      metricsMap[m.metric].push({ value: m.value, unit: m.unit });
    }

    return {
      functions: functionCount,
      members: memberCount,
      totalExecutions,
      metrics: metricsMap,
    };
  }
}
