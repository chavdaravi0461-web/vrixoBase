import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ColumnDefinition {
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

  @ApiPropertyOptional({ example: 'default_value', description: 'Default value for the column' })
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

export class CreateTableDto {
  @ApiProperty({ example: 'users', description: 'Table name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Stores user profiles', description: 'Table description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [ColumnDefinition], example: [{ name: 'email', type: 'text', isNullable: false, isUnique: true }], description: 'Column definitions' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnDefinition)
  @IsNotEmpty({ each: true })
  columns: ColumnDefinition[];
}
