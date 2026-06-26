import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { requireProjectMembership } from '../../common/authorization/helpers';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMembers(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m: any) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  async addMember(projectId: string, invitedBy: string, dto: AddMemberDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      const isAlreadyMember = await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId, userId: existingUser.id },
        },
      });

      if (isAlreadyMember) {
        throw new ConflictException('User is already a member of this project');
      }

      const member = await this.prisma.projectMember.create({
        data: {
          userId: existingUser.id,
          projectId,
          role: dto.role,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'create',
          entity: 'member',
          entityId: member.id,
          projectId,
          userId: invitedBy,
          metadata: JSON.stringify({ email: dto.email, role: dto.role }),
        },
      });

      return member;
    }

    const existingInvite = await this.prisma.invitation.findFirst({
      where: {
        projectId,
        email: dto.email,
        status: 'pending',
      },
    });

    if (existingInvite) {
      throw new ConflictException('An invitation has already been sent to this email');
    }

    const invitation = await this.prisma.invitation.create({
      data: {
        email: dto.email,
        role: dto.role,
        token: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        projectId,
        invitedBy,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'invite',
        entity: 'member',
        entityId: invitation.id,
        projectId,
        userId: invitedBy,
        metadata: JSON.stringify({ email: dto.email, role: dto.role }),
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      message: 'Invitation sent',
    };
  }

  async updateMemberRole(id: string, role: string, userId?: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    await requireProjectMembership(this.prisma, member.projectId, userId);

    const validRoles = ['admin', 'developer', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
    }

    const updated = await this.prisma.projectMember.update({
      where: { id },
      data: { role },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          action: 'update',
          entity: 'member',
          entityId: id,
          projectId: member.projectId,
          userId,
          metadata: JSON.stringify({ newRole: role }),
        },
      });
    }

    return updated;
  }

  async removeMember(id: string, userId?: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    await requireProjectMembership(this.prisma, member.projectId, userId);

    const adminCount = await this.prisma.projectMember.count({
      where: { projectId: member.projectId, role: 'admin' },
    });

    if (adminCount <= 1 && member.role === 'admin') {
      throw new BadRequestException('Cannot remove the last admin. Promote another member first.');
    }

    await this.prisma.projectMember.delete({ where: { id } });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          action: 'delete',
          entity: 'member',
          entityId: id,
          projectId: member.projectId,
          userId,
        },
      });
    }
  }

  async getInvitations(projectId: string) {
    return this.prisma.invitation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
