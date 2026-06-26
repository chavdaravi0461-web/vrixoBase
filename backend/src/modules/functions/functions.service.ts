import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireProjectMembership } from '../../common/authorization/helpers';
import { CreateFunctionDto } from './dto/create-function.dto';
import { ExecuteFunctionDto } from './dto/execute-function.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class FunctionsService {
  private readonly logger = new Logger(FunctionsService.name);
  private readonly functionsDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.functionsDir = path.join(process.cwd(), '.functions');
    this.ensureFunctionsDir();
  }

  private async ensureFunctionsDir() {
    try {
      await fs.mkdir(this.functionsDir, { recursive: true });
    } catch {
      // directory exists
    }
  }

  async create(projectId: string, dto: CreateFunctionDto, userId: string) {
    const existing = await this.prisma.function.findFirst({
      where: { slug: dto.slug, projectId },
    });
    if (existing) {
      throw new ConflictException('A function with this slug already exists');
    }

    const func = await this.prisma.function.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        sourceCode: dto.sourceCode,
        runtime: (dto.runtime ?? 'NODE18') as any,
        handler: dto.handler ?? 'index.handler',
        memory: dto.memory ?? 256,
        timeout: dto.timeout ?? 30,
        environment: dto.environment ?? {},
        projectId,
        createdById: userId,
      },
    });

    await this.writeFunctionFile(func.id, dto.sourceCode);

    await this.prisma.auditLog.create({
      data: {
        action: 'create',
        entity: 'function',
        entityId: func.id,
        projectId,
        userId,
      },
    });

    return func;
  }

  async list(projectId: string) {
    return this.prisma.function.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(projectId: string, id: string) {
    const func = await this.prisma.function.findFirst({
      where: { id, projectId },
    });
    if (!func) throw new NotFoundException('Function not found');
    return func;
  }

  async update(projectId: string, id: string, dto: Partial<CreateFunctionDto>) {
    const func = await this.get(projectId, id);

    const updated = await this.prisma.function.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sourceCode !== undefined && { sourceCode: dto.sourceCode }),
        ...(dto.runtime !== undefined && { runtime: dto.runtime as any }),
        ...(dto.handler !== undefined && { handler: dto.handler }),
        ...(dto.memory !== undefined && { memory: dto.memory }),
        ...(dto.timeout !== undefined && { timeout: dto.timeout }),
        ...(dto.environment !== undefined && { environment: dto.environment }),
      },
    });

    if (dto.sourceCode) {
      await this.writeFunctionFile(func.id, dto.sourceCode);
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'update',
        entity: 'function',
        entityId: id,
        projectId,
        metadata: JSON.stringify({ changes: Object.keys(dto) }),
      },
    });

    return updated;
  }

  async delete(projectId: string, id: string) {
    await this.get(projectId, id);
    await this.prisma.function.delete({ where: { id } });

    const filePath = this.getFunctionFilePath(id);
    try {
      await fs.unlink(filePath);
    } catch {
      // file may not exist
    }
  }

  async executeFunction(
    projectId: string,
    functionId: string,
    dto: ExecuteFunctionDto,
    userId?: string,
  ) {
    const func = await this.get(projectId, functionId);
    const executionId = uuidv4();
    const startTime = Date.now();

    await this.prisma.functionExecution.create({
      data: {
        id: executionId,
        status: 'running',
        payload: (dto.payload ?? {}) as any,
        functionId,
        triggeredById: userId,
      },
    });

    try {
      const result = await this.runInIsolatedProcess(func as { sourceCode: string; timeout: number; handler: string; environment?: Record<string, string> | null }, dto.payload ?? {});
      const duration = Date.now() - startTime;

      await this.prisma.functionExecution.update({
        where: { id: executionId },
        data: {
          status: 'success',
          duration,
          output: JSON.stringify(result),
          completedAt: new Date(),
        },
      });

      return { executionId, status: 'success', output: result, duration };
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      await this.prisma.functionExecution.update({
        where: { id: executionId },
        data: {
          status: 'error',
          duration,
          error: errorMessage,
          completedAt: new Date(),
        },
      });

      return { executionId, status: 'error', error: errorMessage, duration };
    }
  }

  private async runInIsolatedProcess(
    func: { sourceCode: string; timeout: number; handler: string; environment?: Record<string, string> | null },
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    const tmpFile = path.join(this.functionsDir, `${uuidv4()}.js`);
    const wrapperCode = `
      const func = ${func.sourceCode};
      const handler = typeof func === 'function' ? func : (typeof func === 'object' && func.handler ? func.handler : () => {});
      const result = handler(payload);
      process.stdout.write(JSON.stringify(result !== undefined ? result : { success: true }));
    `;

    await fs.writeFile(
      tmpFile,
      `const payload = ${JSON.stringify(payload)};\n${wrapperCode}`,
      'utf-8',
    );

    return new Promise((resolve, reject) => {
      const proc = spawn('node', [tmpFile], {
        timeout: func.timeout * 1000,
        env: {
          ...process.env,
          ...(func.environment ?? {}),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', async (code) => {
        try {
          await fs.unlink(tmpFile);
        } catch {
          // ignore cleanup errors
        }

        if (code !== 0) {
          reject(new Error(stderr || `Process exited with code ${code}`));
        } else {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve(stdout);
          }
        }
      });

      proc.on('error', async (err) => {
        try {
          await fs.unlink(tmpFile);
        } catch {
          // ignore cleanup errors
        }
        reject(err);
      });
    });
  }

  private async writeFunctionFile(id: string, sourceCode: string) {
    const filePath = this.getFunctionFilePath(id);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, sourceCode, 'utf-8');
  }

  private getFunctionFilePath(id: string) {
    return path.join(this.functionsDir, `${id}.js`);
  }

  async getExecutionLogs(projectId: string, functionId: string) {
    await this.get(projectId, functionId);
    return this.prisma.functionExecution.findMany({
      where: { functionId },
      orderBy: { triggeredAt: 'desc' },
      take: 100,
    });
  }

  async createWebhook(projectId: string, dto: CreateWebhookDto) {
    if (dto.functionId) {
      await this.get(projectId, dto.functionId);
    }

    const webhook = await this.prisma.webhook.create({
      data: {
        name: dto.name,
        url: dto.url,
        events: dto.events,
        secret: dto.secret,
        headers: dto.headers ?? {},
        isActive: dto.active ?? true,
        projectId,
        functionId: dto.functionId,
      },
    });

    return webhook;
  }

  async listWebhooks(projectId: string) {
    return this.prisma.webhook.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteWebhook(id: string, userId?: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    await requireProjectMembership(this.prisma, webhook.projectId, userId);
    await this.prisma.webhook.delete({ where: { id } });
  }

  async triggerWebhook(webhookId: string, event: string, payload: unknown) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook || !webhook.isActive) return;

    try {
      const fetch = await import('node-fetch');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        ...(webhook.headers as Record<string, string>),
      };

      if (webhook.secret) {
        headers['X-Webhook-Signature'] = webhook.secret;
      }

      await (fetch.default || fetch)(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() }),
      });
    } catch (err) {
      this.logger.error(`Webhook ${webhookId} trigger failed: ${err}`);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async cleanupOldExecutions() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    await this.prisma.functionExecution.deleteMany({
      where: {
        triggeredAt: { lt: cutoff },
        status: { in: ['success', 'error'] },
      },
    });

    this.logger.log('Cleaned up function execution logs older than 30 days');
  }
}
