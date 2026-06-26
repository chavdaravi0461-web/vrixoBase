import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDatabaseMetrics(projectId: string) {
    const [
      functionCount,
      policyCount,
      executionCount,
      storageUsed,
    ] = await Promise.all([
      this.prisma.function.count({ where: { projectId } }),
      this.prisma.policy.count({ where: { projectId } }),
      this.prisma.functionExecution.count({
        where: { function: { projectId } },
      }),
      this.getProjectStorageSize(projectId),
    ]);

    return {
      functions: functionCount,
      policies: policyCount,
      totalExecutions: executionCount,
      storageUsed,
      tables: 0, // Would query real DB in production
      activeConnections: 0,
    };
  }

  async getApiMetrics(projectId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentExecutions = await this.prisma.functionExecution.findMany({
      where: {
        function: { projectId },
        triggeredAt: { gte: thirtyDaysAgo },
      },
      select: { duration: true, status: true, triggeredAt: true },
    });

    const totalRequests = recentExecutions.length;
    const successful = recentExecutions.filter((e: any) => e.status === 'success').length;
    const durations = recentExecutions
      .filter((e: any) => e.duration != null)
      .map((e: any) => e.duration as number);

    const avgLatency = durations.length
      ? Math.round(durations.reduce((a: any, b: any) => a + b, 0) / durations.length)
      : 0;

    return {
      totalRequests,
      avgLatencyMs: avgLatency,
      successRate: totalRequests ? Math.round((successful / totalRequests) * 10000) / 100 : 100,
      errorRate: totalRequests
        ? Math.round(((totalRequests - successful) / totalRequests) * 10000) / 100
        : 0,
      timeframe: '30d',
    };
  }

  async getStorageMetrics(projectId: string) {
    const functionCount = await this.prisma.function.count({ where: { projectId } });
    const executionCount = await this.prisma.functionExecution.count({
      where: { function: { projectId } },
    });

    return {
      totalFiles: functionCount,
      totalSize: 0, // Would query MinIO in production
      fileBreakdown: [
        { type: 'functions', count: functionCount },
        { type: 'executions', count: executionCount },
      ],
      bucketCount: 0,
    };
  }

  async getRealtimeMetrics(projectId: string) {
    return {
      activeConnections: 0,
      messagesPerSecond: 0,
      totalMessages: 0,
      channels: 0,
      peakConnections: 0,
    };
  }

  async getErrorTracking(projectId: string, timeframe: string) {
    const since = new Date();
    switch (timeframe) {
      case '1h':
        since.setHours(since.getHours() - 1);
        break;
      case '24h':
        since.setDate(since.getDate() - 1);
        break;
      case '7d':
        since.setDate(since.getDate() - 7);
        break;
      case '30d':
        since.setDate(since.getDate() - 30);
        break;
      default:
        since.setDate(since.getDate() - 7);
    }

    const errors = await this.prisma.functionExecution.findMany({
      where: {
        function: { projectId },
        status: 'error',
        triggeredAt: { gte: since },
      },
      orderBy: { triggeredAt: 'desc' },
      take: 100,
      include: { function: { select: { name: true } } },
    });

    const grouped = this.groupErrors(errors);

    return {
      totalErrors: errors.length,
      timeframe,
      errors: errors.map((e: any) => ({
        id: e.id,
        functionName: e.function.name,
        error: e.error,
        timestamp: e.triggeredAt,
      })),
      grouped,
    };
  }

  private groupErrors(
    errors: Array<{ error?: string | null; triggeredAt: Date; function: { name: string } }>,
  ) {
    const groups: Record<string, { count: number; lastSeen: Date; functions: Set<string> }> = {};

    for (const err of errors) {
      const key = err.error || 'Unknown error';
      if (!groups[key]) {
        groups[key] = { count: 0, lastSeen: err.triggeredAt, functions: new Set() };
      }
      groups[key].count++;
      groups[key].lastSeen = err.triggeredAt;
      groups[key].functions.add(err.function.name);
    }

    return Object.entries(groups).map(([error, info]) => ({
      error,
      count: info.count,
      lastSeen: info.lastSeen,
      functions: Array.from(info.functions),
    }));
  }

  async recordMetric(
    projectId: string,
    name: string,
    value: number,
    unit: string,
  ) {
    return this.prisma.usageMetric.create({
      data: { metric: name, value, unit, projectId },
    });
  }

  async getUsage(projectId: string, metricName?: string) {
    const where: Record<string, unknown> = { projectId };
    if (metricName) where.name = metricName;

    const metrics = await this.prisma.usageMetric.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: 1000,
    });

    return metrics;
  }

  async getHealth() {
    const checks: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'healthy';
    } catch {
      checks.database = 'unhealthy';
    }

    checks.redis = 'unknown';
    checks.minio = 'unknown';

    const allHealthy = Object.values(checks).every((s) => s === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  private async getProjectStorageSize(_projectId: string): Promise<number> {
    return 0;
  }
}
