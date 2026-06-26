import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AddColumnDto } from './add-column.dto';

export class UpdateTableDto {
  @ApiPropertyOptional({ example: 'renamed_table', description: 'New table name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description', description: 'New table description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [AddColumnDto], example: [{ name: 'age', type: 'integer', isNullable: true }], description: 'Additional columns to add' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddColumnDto)
  columns?: AddColumnDto[];
}
