import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'My API Key', description: 'API key name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: ['PUBLIC', 'SECRET'], default: 'SECRET' })
  @IsOptional()
  @IsString()
  @IsIn(['PUBLIC', 'SECRET'])
  type?: 'PUBLIC' | 'SECRET' = 'SECRET';
}
