import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';
import * as crypto from 'crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  private allowedOrigins: string[];

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    const origins = this.configService.get<string>('CORS_ORIGINS', 'http://localhost:3000');
    this.allowedOrigins = origins.split(',').map((o) => o.trim());
  }

  canActivate(context: ExecutionContext): boolean {
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipCsrf) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    if (SAFE_METHODS.has(method)) return true;

    const origin = request.headers['origin'] as string | undefined;
    const referer = request.headers['referer'] as string | undefined;

    if (origin) {
      const isAllowed = this.allowedOrigins.some(
        (allowed) =>
          origin === allowed ||
          origin.endsWith(`://${allowed.replace(/^https?:\/\//, '')}`),
      );
      if (!isAllowed) {
        throw new ForbiddenException('Cross-origin request blocked by CSRF guard');
      }
    } else if (referer) {
      const refererOrigin = new URL(referer).origin;
      const isAllowed = this.allowedOrigins.some(
        (allowed) =>
          refererOrigin === allowed ||
          refererOrigin.endsWith(`://${allowed.replace(/^https?:\/\//, '')}`),
      );
      if (!isAllowed) {
        throw new ForbiddenException('Cross-origin request blocked by CSRF guard');
      }
    }

    const csrfCookie = request.cookies?.['csrf-token'] as string | undefined;
    const csrfHeader = request.headers['x-csrf-token'] as string | undefined;

    if (csrfCookie && csrfHeader) {
      if (!crypto.timingSafeEqual(Buffer.from(csrfCookie), Buffer.from(csrfHeader))) {
        throw new ForbiddenException('CSRF token mismatch');
      }
    }

    return true;
  }
}
