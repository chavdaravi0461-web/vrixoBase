import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SecretType {
  ENVIRONMENT = 'environment',
  API_KEY = 'api-key',
  DATABASE = 'database',
}

export class CreateSecretDto {
  @ApiProperty({ example: 'DATABASE_URL', description: 'Secret name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'postgresql://user:pass@host:5432/mydb', description: 'Secret value (will be encrypted)' })
  @IsString()
  value: string;

  @ApiPropertyOptional({ enum: SecretType, default: SecretType.ENVIRONMENT, description: 'Type of secret' })
  @IsOptional()
  @IsEnum(SecretType)
  type?: SecretType;
}
