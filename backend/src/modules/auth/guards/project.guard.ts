import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { requireProjectMembership } from '../../../common/authorization/helpers';

export const PROJECT_ROLE_KEY = 'project:role';

@Injectable()
export class ProjectGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const projectId = request.params?.projectId;

    if (!projectId) return true;

    const userId = request.user?.id;

    const member = await requireProjectMembership(this.prisma, projectId, userId);

    const requiredRole = this.reflector.getAllAndOverride<string>(PROJECT_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRole && member.role !== requiredRole && member.role !== 'ADMIN') {
      throw new ForbiddenException(`Required role: ${requiredRole} or higher`);
    }

    return true;
  }
}
