import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePolicyDto {
  @ApiProperty({ example: 'user_isolation_policy', description: 'Policy name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'profiles', description: 'Target table name' })
  @IsString()
  tableName: string;

  @ApiProperty({ example: "USING (user_id = current_user_id())", description: 'RLS policy SQL definition' })
  @IsString()
  definition: string;

  @ApiPropertyOptional({ example: ['authenticated', 'admin'], description: 'Roles this policy applies to', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
