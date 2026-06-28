import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsPolicyEngineService } from '../rls/rls-policy-engine.service';
import { requireProjectMembership } from '../../common/authorization/helpers';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { CreateSecretDto } from './dto/create-secret.dto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private encryptionKey: Buffer;
  private keyVersion = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsPolicyEngine: RlsPolicyEngineService,
  ) {
    this.initializeEncryptionKey();
  }

  private initializeEncryptionKey() {
    const baseKey = process.env.ENCRYPTION_KEY;
    if (baseKey) {
      const salt = process.env.ENCRYPTION_SALT || 'vrixobase-default-salt';
      this.encryptionKey = scryptSync(baseKey, salt, KEY_LENGTH);
    } else {
      this.encryptionKey = randomBytes(KEY_LENGTH);
      this.logger.warn(
        'No ENCRYPTION_KEY set. Using random key - secrets will not persist across restarts.',
      );
    }
  }

  async createPolicy(projectId: string, userId: string, dto: CreatePolicyDto) {
    const existing = await this.prisma.policy.findFirst({
      where: {
        projectId,
        tableName: dto.tableName,
        name: dto.name,
      },
    });
    if (existing) {
      throw new ConflictException('A policy with this name already exists on this table');
    }

    const policy = await this.prisma.policy.create({
      data: {
        name: dto.name,
        tableName: dto.tableName,
        definition: dto.definition,
        roles: dto.roles ?? ['authenticated'],
        projectId,
      },
    });

    await this.rlsPolicyEngine.applyPolicy({
      projectId,
      tableName: dto.tableName,
      name: dto.name,
      definition: dto.definition,
      roles: dto.roles ?? ['authenticated'],
      status: 'active',
    }).catch((err: Error) => {
      this.logger.error(`Failed to apply RLS policy to PostgreSQL: ${err.message}`);
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'create',
        entity: 'policy',
        entityId: policy.id,
        projectId,
        userId,
      },
    });

    return policy;
  }

  async listPolicies(projectId: string, tableName?: string) {
    const where: Record<string, unknown> = { projectId };
    if (tableName) where.tableName = tableName;

    return this.prisma.policy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async deletePolicy(id: string, userId?: string) {
    const policy = await this.prisma.policy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException('Policy not found');

    await requireProjectMembership(this.prisma, policy.projectId, userId);

    await this.rlsPolicyEngine.removePolicy(policy).catch((err: Error) => {
      this.logger.error(`Failed to remove RLS policy from PostgreSQL: ${err.message}`);
    });

    await this.prisma.policy.delete({ where: { id } });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          action: 'delete',
          entity: 'policy',
          entityId: id,
          projectId: policy.projectId,
          userId,
        },
      });
    }
  }

  async evaluatePolicy(
    projectId: string,
    tableName: string,
    userId: string,
    action: string,
  ): Promise<boolean> {
    const policies = await this.prisma.policy.findMany({
      where: {
        projectId,
        tableName,
        status: 'active',
      },
    });

    for (const policy of policies) {
      if (policy.roles.length > 0) {
        const member = await this.prisma.projectMember.findFirst({
          where: { projectId, userId },
        });
        if (!member || !policy.roles.includes(member.role)) {
          continue;
        }
      }

      const allowed = await this.evaluatePolicyExpression(policy.definition, {
        userId,
        action,
        tableName,
      });
      if (!allowed) return false;
    }

    return true;
  }

  private async evaluatePolicyExpression(
    definition: string,
    context: Record<string, unknown>,
  ): Promise<boolean> {
    const trimmed = definition.trim().toLowerCase();

    if (trimmed === 'true' || trimmed === '(true)') return true;
    if (trimmed === 'false' || trimmed === '(false)') return false;

    if (trimmed === 'authenticated' || trimmed === '(authenticated)') {
      return !!context.userId;
    }

    const uidMatch = trimmed.match(/auth\.uid\(\s*\)\s*=\s*'([^']+)'/);
    if (uidMatch) {
      return context.userId === uidMatch[1];
    }

    if (trimmed.includes('auth.uid()') && !uidMatch) {
      return !!context.userId;
    }

    const roleMatch = trimmed.match(/auth\.role\(\s*\)\s*=\s*'([^']+)'/);
    if (roleMatch) {
      const member = await this.prisma.projectMember.findFirst({
        where: { projectId: context.projectId as string, userId: context.userId as string },
      });
      return member?.role?.toLowerCase() === roleMatch[1].toLowerCase();
    }

    this.logger.warn(`Unsupported RLS policy definition: ${definition}. Defaulting to deny.`);
    return false;
  }

  encryptSecret(value: string): { encrypted: string; iv: string; tag: string; keyVersion: number } {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag,
      keyVersion: this.keyVersion,
    };
  }

  decryptSecret(encrypted: string, iv: string, tag: string): string {
    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async createSecret(projectId: string, userId: string, dto: CreateSecretDto) {
    const existing = await this.prisma.secret.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException('A secret with this name already exists');
    }

    const { encrypted, iv, tag, keyVersion } = this.encryptSecret(dto.value);

    const secret = await this.prisma.secret.create({
      data: {
        name: dto.name,
        value: JSON.stringify({ encrypted, iv, tag, keyVersion }),
        type: dto.type ?? 'environment',
        projectId,
        userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'create',
        entity: 'secret',
        entityId: secret.id,
        projectId,
        userId,
      },
    });

    return { id: secret.id, name: secret.name, type: secret.type, createdAt: secret.createdAt };
  }

  async listSecrets(projectId: string) {
    const secrets = await this.prisma.secret.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return secrets.map((s: any) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async getSecretValue(projectId: string, id: string): Promise<string> {
    const secret = await this.prisma.secret.findFirst({
      where: { id, projectId },
    });
    if (!secret) throw new NotFoundException('Secret not found');

    const { encrypted, iv, tag } = JSON.parse(secret.value);
    return this.decryptSecret(encrypted, iv, tag);
  }

  async deleteSecret(projectId: string, id: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id, projectId },
    });
    if (!secret) throw new NotFoundException('Secret not found');
    await this.prisma.secret.delete({ where: { id } });
  }

  rotateEncryptionKey() {
    this.keyVersion++;
    this.encryptionKey = randomBytes(KEY_LENGTH);
    this.logger.log(`Encryption key rotated to version ${this.keyVersion}`);
  }
}
