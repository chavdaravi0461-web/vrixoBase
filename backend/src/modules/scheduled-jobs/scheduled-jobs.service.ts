import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FunctionsService } from '../functions/functions.service';
import { CreateScheduledJobDto } from './dto/create-scheduled-job.dto';
import { UpdateScheduledJobDto } from './dto/update-scheduled-job.dto';
import { CronExpressionParser } from 'cron-parser';

@Injectable()
export class ScheduledJobsService {
  private readonly logger = new Logger(ScheduledJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly functionsService: FunctionsService,
  ) {}

  async create(projectId: string, dto: CreateScheduledJobDto) {
    await this.functionsService.get(projectId, dto.functionId);

    const nextRunAt = this.computeNextRun(dto.schedule);

    return this.prisma.scheduledJob.create({
      data: {
        projectId,
        name: dto.name,
        functionId: dto.functionId,
        schedule: dto.schedule,
        isActive: dto.isActive ?? true,
        nextRunAt,
      },
    });
  }

  async list(projectId: string) {
    return this.prisma.scheduledJob.findMany({
      where: { projectId },
      include: { function: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(projectId: string, id: string) {
    const job = await this.prisma.scheduledJob.findFirst({
      where: { id, projectId },
      include: { function: { select: { id: true, name: true, slug: true } } },
    });
    if (!job) throw new NotFoundException('Scheduled job not found');
    return job;
  }

  async update(projectId: string, id: string, dto: UpdateScheduledJobDto) {
    await this.get(projectId, id);

    if (dto.functionId) {
      await this.functionsService.get(projectId, dto.functionId);
    }

    const nextRunAt = dto.schedule ? this.computeNextRun(dto.schedule) : undefined;

    return this.prisma.scheduledJob.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.functionId !== undefined && { functionId: dto.functionId }),
        ...(dto.schedule !== undefined && { schedule: dto.schedule }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(nextRunAt !== undefined && { nextRunAt }),
      },
    });
  }

  async delete(projectId: string, id: string) {
    await this.get(projectId, id);
    await this.prisma.scheduledJob.delete({ where: { id } });
  }

  async toggleActive(projectId: string, id: string, isActive: boolean) {
    const job = await this.get(projectId, id);
    return this.prisma.scheduledJob.update({
      where: { id },
      data: { isActive, nextRunAt: isActive ? this.computeNextRun(job.schedule) : null },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueJobs() {
    const dueJobs = await this.prisma.scheduledJob.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: new Date() },
      },
      include: { function: true },
    });

    for (const job of dueJobs) {
      this.logger.log(`Running scheduled job "${job.name}" (${job.id})`);

      await this.functionsService.executeFunction(
        job.projectId,
        job.functionId,
        { payload: { scheduledJobId: job.id, jobName: job.name } },
        'system',
      );

      const nextRun = this.computeNextRun(job.schedule);

      await this.prisma.scheduledJob.update({
        where: { id: job.id },
        data: { lastRunAt: new Date(), nextRunAt: nextRun },
      });
    }
  }

  private computeNextRun(cronExpression: string): Date {
    try {
      const interval = CronExpressionParser.parse(cronExpression);
      return interval.next().toDate();
    } catch {
      this.logger.warn(`Invalid cron expression: ${cronExpression}, defaulting to +1 hour`);
      const fallback = new Date();
      fallback.setHours(fallback.getHours() + 1);
      return fallback;
    }
  }
}
