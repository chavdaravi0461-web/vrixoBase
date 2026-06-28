import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduledJobDto {
  @ApiProperty({ example: 'Daily report generator', description: 'Job name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'clx...', description: 'Function ID to invoke' })
  @IsString()
  functionId: string;

  @ApiProperty({ example: '0 8 * * *', description: 'Cron schedule expression' })
  @IsString()
  schedule: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the job is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
