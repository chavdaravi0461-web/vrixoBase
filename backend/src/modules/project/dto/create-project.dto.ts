import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectRegion {
  US_EAST_1 = 'us-east-1',
  US_WEST_1 = 'us-west-1',
  EU_WEST_1 = 'eu-west-1',
  EU_CENTRAL_1 = 'eu-central-1',
  AP_SOUTHEAST_1 = 'ap-southeast-1',
}

export enum ProjectPlan {
  FREE = 'FREE',
  PRO = 'PRO',
  TEAM = 'TEAM',
  ENTERPRISE = 'ENTERPRISE',
}

export class CreateProjectDto {
  @ApiProperty({ example: 'My Project', description: 'Project name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'My first VrixoBase project', description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProjectRegion, default: ProjectRegion.US_EAST_1, description: 'Deployment region' })
  @IsOptional()
  @IsEnum(ProjectRegion)
  region?: ProjectRegion;

  @ApiPropertyOptional({ enum: ProjectPlan, default: ProjectPlan.FREE, description: 'Subscription plan' })
  @IsOptional()
  @IsEnum(ProjectPlan)
  plan?: ProjectPlan;
}
