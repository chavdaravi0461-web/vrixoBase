import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

interface JwtPayload {
  sub?: string;
  id?: string;
  email?: string;
  role?: string;
  projectId?: string;
  [key: string]: unknown;
}

@Injectable()
export class RlsSessionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RlsSessionMiddleware.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers['authorization'] as string | undefined;
      const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
      const projectIdParam =
        req.params?.projectId ||
        (req.query?.projectId as string) ||
        (req.body as Record<string, string>)?.projectId;

      let userId: string | null = null;
      let userRole: string | null = null;
      let projectId: string | null = projectIdParam || null;

      if (apiKeyHeader) {
        const keyInfo = await this.resolveApiKeyIdentity(apiKeyHeader);
        if (keyInfo) {
          userId = keyInfo.userId;
          userRole = keyInfo.userRole;
          projectId = projectId || keyInfo.projectId;
        }
      }

      if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          const secret = this.configService.get<string>('JWT_ACCESS_SECRET', '');
          const payload = this.jwtService.verify<JwtPayload>(token, { secret });
          userId = payload.sub || payload.id || null;
          userRole = payload.role || 'authenticated';
        } catch {
          this.logger.debug('JWT verification failed in RLS middleware');
        }
      }

      if (userId) {
        await this.prisma.$executeRawUnsafe(
          `SELECT set_config('app.current_user_id', $1, true)`,
          [userId],
        ).catch(() => {});

        await this.prisma.$executeRawUnsafe(
          `SELECT set_config('app.current_user_role', $1, true)`,
          [userRole || 'authenticated'],
        ).catch(() => {});

        if (projectId) {
          await this.prisma.$executeRawUnsafe(
            `SELECT set_config('app.current_project_id', $1, true)`,
            [projectId],
          ).catch(() => {});
        }

        (req as any).rlsUserId = userId;
        (req as any).rlsUserRole = userRole;
        (req as any).rlsProjectId = projectId;
      }
    } catch (err) {
      this.logger.debug(`RLS session setup error (non-fatal): ${(err as Error).message}`);
    }

    next();
  }

  private async resolveApiKeyIdentity(
    key: string,
  ): Promise<{ userId: string | null; userRole: string | null; projectId: string } | null> {
    if (!key.startsWith('vb_')) return null;

    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(key).digest('hex');

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        OR: [{ keyHash: hash }, { key }],
      },
      select: {
        projectId: true,
        type: true,
        createdById: true,
        expiresAt: true,
      },
    });

    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    return {
      userId: apiKey.createdById,
      userRole: apiKey.type === 'PUBLIC' ? 'anon' : 'service_role',
      projectId: apiKey.projectId,
    };
  }
}
