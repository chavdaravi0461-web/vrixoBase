import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as Minio from 'minio';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  error?: string;
}

interface DependencyHealth {
  database: HealthCheckResult;
  redis: HealthCheckResult;
  minio: HealthCheckResult;
  storage: HealthCheckResult;
  realtime: HealthCheckResult;
  ai: HealthCheckResult;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime: number;
  private ready = false;
  private readyPromise: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.startTime = Date.now();
    this.readyPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.ready = true;
      this.logger.log('HealthService initialized, system ready');
    } catch (err) {
      this.logger.error(`HealthService init failed: ${(err as Error).message}`);
      this.ready = false;
    }
  }

  get uptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  get isReady(): boolean {
    return this.ready;
  }

  async waitForReady(): Promise<void> {
    return this.readyPromise;
  }

  async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'unhealthy', latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  async checkRedis(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);

      const { default: net } = await import('net');
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(3000);
        socket.on('data', (data) => {
          socket.destroy();
          if (data.toString().includes('PONG') || data.toString().includes('+PONG')) resolve();
          else reject(new Error('Unexpected response'));
        });
        socket.on('error', (err) => { socket.destroy(); reject(err); });
        socket.on('timeout', () => { socket.destroy(); reject(new Error('Redis not responding')); });
        socket.connect(port, host);
        socket.write(Buffer.from('*1\r\n$4\r\nPING\r\n'));
      });

      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'unhealthy', latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  async checkMinio(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
      const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
      const protocol = useSSL ? 'https' : 'http';
      const port = this.configService.get<string>('MINIO_PORT', useSSL ? '' : '9000');
      const hostPort = port ? `${endpoint}:${port}` : endpoint;
      const url = `${protocol}://${hostPort}/minio/health/live`;
      const result = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (result.ok) {
        return { status: 'healthy', latencyMs: Date.now() - start };
      }
      return { status: 'unhealthy', latencyMs: Date.now() - start, error: `MinIO health returned ${result.status}` };
    } catch {
      try {
        const client = new Minio.Client({
          endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
          port: Number(this.configService.get<string>('MINIO_PORT', '0')) || undefined,
          useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
          accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
          secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
        });
        await client.listBuckets();
        return { status: 'healthy', latencyMs: Date.now() - start };
      } catch (err2) {
        return { status: 'unhealthy', latencyMs: Date.now() - start, error: (err2 as Error).message };
      }
    }
  }

  async checkStorage(): Promise<HealthCheckResult> {
    return this.checkMinio();
  }

  async checkRealtime(): Promise<HealthCheckResult> {
    const result = await this.checkRedis();
    if (result.status === 'healthy') return result;
    return { ...result, status: 'degraded' };
  }

  async checkAi(): Promise<HealthCheckResult> {
    const start = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { status: 'degraded', latencyMs: Date.now() - start, error: 'OPENAI_API_KEY not configured' };
    }
    return { status: 'healthy', latencyMs: Date.now() - start };
  }

  async checkAll(): Promise<{ status: string; checks: DependencyHealth; uptime: number; timestamp: string }> {
    const [database, redis, minio, storage, realtime, ai] = await Promise.all([
      this.checkDatabase(), this.checkRedis(), this.checkMinio(),
      this.checkStorage(), this.checkRealtime(), this.checkAi(),
    ]);
    const allHealthy = [database, redis, minio, storage, realtime, ai]
      .every((c) => c.status === 'healthy');
    const anyUnhealthy = [database, redis, minio, storage, realtime, ai]
      .some((c) => c.status === 'unhealthy');
    return {
      status: allHealthy ? 'healthy' : anyUnhealthy ? 'degraded' : 'healthy',
      checks: { database, redis, minio, storage, realtime, ai },
      uptime: this.uptimeSeconds,
      timestamp: new Date().toISOString(),
    };
  }

  async getVersion(): Promise<{ version: string; commit: string; buildTime: string }> {
    return {
      version: process.env.npm_package_version || '0.1.0',
      commit: process.env.GIT_COMMIT || 'unknown',
      buildTime: process.env.BUILD_TIME || 'unknown',
    };
  }
}
