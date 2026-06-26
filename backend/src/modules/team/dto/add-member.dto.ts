import { IsString, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum MemberRole {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export class AddMemberDto {
  @ApiProperty({ example: 'collaborator@example.com', description: 'Member email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: MemberRole, default: MemberRole.MEMBER, description: 'Member role in the team' })
  @IsEnum(MemberRole)
  role: MemberRole;
}
