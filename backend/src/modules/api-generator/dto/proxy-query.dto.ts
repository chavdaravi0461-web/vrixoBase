import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProxyQueryDto {
  @ApiPropertyOptional({ description: 'Columns to select (comma-separated)', example: 'id,name,email' })
  @IsOptional()
  @IsString()
  select?: string;

  @ApiPropertyOptional({ description: 'Order by clause', example: 'name:asc' })
  @IsOptional()
  @IsString()
  order?: string;

  @ApiPropertyOptional({ description: 'Maximum records to return', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Number of records to skip', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ example: 'john', description: 'Search term to filter results' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '{"status":"active"}', description: 'JSON-encoded filter conditions' })
  @IsOptional()
  @IsString()
  filters?: string;
}
