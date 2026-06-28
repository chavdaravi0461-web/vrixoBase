import { IsOptional, IsString, IsInt, Min, Max, IsIn, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProxyQueryDto {
  @ApiPropertyOptional({ description: 'Columns to select (comma-separated, supports nested relations)', example: 'id,name,email,posts(*)' })
  @IsOptional()
  @IsString()
  select?: string;

  @ApiPropertyOptional({ description: 'Order by clause (PostgREST style)', example: 'name.asc,id.desc' })
  @IsOptional()
  @IsString()
  order?: string;

  @ApiPropertyOptional({ description: 'Maximum records to return', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Number of records to skip', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: 'Search term to filter across text columns' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter using PostgREST-style query operators (e.g. name=eq.John&age=gt.25)' })
  @IsOptional()
  @IsString()
  filters?: string;

  @ApiPropertyOptional({ description: 'Columns used to detect conflict for upsert', example: 'id' })
  @IsOptional()
  @IsString()
  on_conflict?: string;
}
