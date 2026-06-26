import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NlToSqlDto {
  @ApiProperty({ description: 'Natural language prompt describing the desired query' })
  @IsString()
  @IsNotEmpty()
  prompt: string;
}

export class SqlExplainDto {
  @ApiProperty({ description: 'SQL query to explain' })
  @IsString()
  @IsNotEmpty()
  sql: string;

  @ApiPropertyOptional({ description: 'Optional context about the query' })
  @IsString()
  @IsOptional()
  context?: string;
}

export class AiGenerateSchemaDto {
  @ApiProperty({ description: 'Natural language description of the desired schema' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
