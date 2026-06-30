import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createApiKey(projectId: string, dto: CreateApiKeyDto, userId: string) {
    const { plaintext, hash } = this.generateApiKey();

    const apiKey = await this.prisma.apiKey.create({
      data: {
        projectId,
        name: dto.name,
        key: plaintext,
        keyHash: hash,
        type: dto.type || 'SECRET',
        createdById: userId,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: plaintext,
      type: apiKey.type,
      createdAt: apiKey.createdAt,
    };
  }

  async validateApiKey(key: string) {
    if (key.startsWith('eyJ')) {
      return this.validateJwtApiKey(key);
    }

    const hash = this.hashKey(key);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: { keyHash: hash },
      include: { project: true },
    });

    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return {
      id: apiKey.id,
      projectId: apiKey.projectId,
      type: apiKey.type,
      permissions: apiKey.permissions,
      keyName: apiKey.name,
      projectSlug: apiKey.project.slug,
      projectStatus: apiKey.project.status,
    };
  }

  private async validateJwtApiKey(token: string) {
    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET', 'access-secret');
      const payload = this.jwtService.verify(token, { secret }) as any;

      const role = payload.role;
      if (role !== 'anon' && role !== 'service_role') return null;
      if (!payload.projectId) return null;

      const project = await this.prisma.project.findUnique({
        where: { id: payload.projectId },
        select: { id: true, slug: true, status: true },
      });
      if (!project) return null;

      return {
        id: `jwt_${role}`,
        projectId: project.id,
        type: role === 'anon' ? ('PUBLIC' as const) : ('SECRET' as const),
        permissions: null,
        keyName: `${role}_key`,
        projectSlug: project.slug,
        projectStatus: project.status,
      };
    } catch {
      return null;
    }
  }

  async revokeApiKey(id: string) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.delete({ where: { id } });
    return { message: 'API key revoked successfully' };
  }

  async listApiKeys(projectId: string) {
    return this.prisma.apiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        type: true,
        key: true,
        permissions: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private generateApiKey(): { plaintext: string; hash: string } {
    const raw = crypto.randomBytes(24).toString('hex');
    const plaintext = `vb_${raw}`;
    return { plaintext, hash: this.hashKey(plaintext) };
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
