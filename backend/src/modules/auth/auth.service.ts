import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import ms from 'ms';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name ?? dto.email.split('@')[0],
      },
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000 / 60);
      throw new UnauthorizedException(`Account temporarily locked. Try again in ${remaining} minute(s)`);
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      const maxAttempts = 5;
      const updateData: Record<string, unknown> = {
        failedLoginAttempts: attempts,
        lastFailedLoginAt: new Date(),
      };
      if (attempts >= maxAttempts) {
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        this.logger.warn(`Account locked for ${user.email} due to ${attempts} failed attempts`);
      }
      await this.prisma.user.update({ where: { id: user.id }, data: updateData as any });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string, userAgent?: string, ipAddress?: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (session.revokedAt) {
      this.logger.warn(`Reuse of revoked refresh token detected for userId=${session.userId}`);
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session revoked - all devices logged out');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(session.user, userAgent, ipAddress);
  }

  async logout(userId: string, refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken, userId },
    });
    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async logoutAllDevices(userId: string) {
    const count = await this.prisma.session.count({
      where: { userId, revokedAt: null },
    });
    if (count > 0) {
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { message: `Logged out from ${count} device(s)` };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isActive: true, avatarUrl: true, mfaEnabled: true, createdAt: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');
    return user;
  }

  private get isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV', 'development') === 'production';
  }

  private parseDuration(duration: string): number {
    const value = ms(duration as any) as unknown;
    if (typeof value !== 'number') {
      return 900000;
    }
    return value;
  }

  async generateTokens(user: { id: string; email: string; role: string }, userAgent?: string, ipAddress?: string) {
    const isProd = this.isProduction;
    const accessExpiresIn = this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      isProd ? '15m' : '24h',
    );
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      isProd ? '90d' : '365d',
    );

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: (() => {
          const s = this.configService.get<string>('JWT_ACCESS_SECRET');
          if (!s && this.configService.get<string>('NODE_ENV') === 'production') throw new Error('JWT_ACCESS_SECRET must be set in production');
          return s || 'dev-secret-not-for-production';
        })(),
        expiresIn: accessExpiresIn,
      },
    );

    const refreshTokenValue = uuidv4();
    const refreshMs = this.parseDuration(refreshExpiresIn);
    const expiresAt = new Date(Date.now() + refreshMs);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: refreshTokenValue,
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token, {
        secret: (() => {
          const s = this.configService.get<string>('JWT_ACCESS_SECRET');
          return s || 'dev-secret-not-for-production';
        })(),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async googleLogin(profile: { googleId: string; email: string; name: string; avatarUrl?: string }) {
    if (!profile.email) throw new BadRequestException('Google account has no email');

    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.googleId, avatarUrl: profile.avatarUrl ?? user.avatarUrl },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            googleId: profile.googleId,
            avatarUrl: profile.avatarUrl,
          },
        });
      }
    }

    return this.generateTokens(user);
  }

  async githubLogin(profile: { githubId: string; email: string; name: string; avatarUrl?: string }) {
    if (!profile.email) throw new BadRequestException('GitHub account has no email');

    let user = await this.prisma.user.findUnique({ where: { githubId: profile.githubId } });
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { githubId: profile.githubId, avatarUrl: profile.avatarUrl ?? user.avatarUrl },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            githubId: profile.githubId,
            avatarUrl: profile.avatarUrl,
          },
        });
      }
    }

    return this.generateTokens(user);
  }

  async setupMfa(userId: string, secret: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: true },
    });
    return { message: 'MFA enabled successfully' };
  }

  async verifyMfa(userId: string, token: string, secret: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) throw new BadRequestException('MFA not configured');

    const { totp } = await import('otplib');
    const isValid = totp.verify({ token, secret: user.mfaSecret });
    if (!isValid) throw new BadRequestException('Invalid MFA token');

    return { message: 'MFA verified successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If that email exists, a reset link has been sent' };

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.passwordReset.create({
      data: { email, token, expiresAt },
    });

    this.logger.log(`Password reset requested for ${email}`);
    // In production, send email via mail service instead of logging the token
    // await this.emailService.sendPasswordReset(email, token);
    return { message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordReset.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { email: record.email },
      data: { passwordHash },
    });

    await this.prisma.passwordReset.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const userRecord = await this.prisma.user.findUnique({ where: { email: record.email }, select: { id: true } });
    if (userRecord) {
      await this.prisma.session.deleteMany({ where: { userId: userRecord.id } });
    }

    return { message: 'Password reset successfully' };
  }
}
