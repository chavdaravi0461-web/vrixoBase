import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddColumnDto {
  @ApiProperty({ example: 'email', description: 'Column name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'text', description: 'Column data type' })
  @IsString()
  @IsNotEmpty()
  @IsIn(
    [
      'text',
      'varchar',
      'integer',
      'bigint',
      'smallint',
      'boolean',
      'float',
      'double precision',
      'decimal',
      'numeric',
      'date',
      'timestamp',
      'timestamptz',
      'time',
      'json',
      'jsonb',
      'uuid',
      'serial',
      'bigserial',
    ],
    { message: 'Unsupported column type' },
  )
  type: string;

  @ApiPropertyOptional({ example: 0, description: 'Default value for the column' })
  @IsOptional()
  defaultValue?: unknown;

  @ApiPropertyOptional({ default: false, description: 'Allow NULL values' })
  @IsOptional()
  @IsBoolean()
  isNullable?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Unique constraint' })
  @IsOptional()
  @IsBoolean()
  isUnique?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Primary key' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
