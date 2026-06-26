import { IsString, IsOptional, IsInt, Min, Max, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FunctionRuntime {
  NODE16 = 'node16',
  NODE18 = 'node18',
  NODE20 = 'node20',
}

export class CreateFunctionDto {
  @ApiProperty({ example: 'hello-world', description: 'Function name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'hello-world', description: 'URL-friendly slug' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ example: 'A simple hello world function', description: 'Function description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'exports.handler = async (req, res) => { res.send({ message: "Hello" }); };', description: 'Source code of the function' })
  @IsString()
  sourceCode: string;

  @ApiPropertyOptional({ enum: FunctionRuntime, default: FunctionRuntime.NODE18, description: 'Runtime environment' })
  @IsOptional()
  @IsEnum(FunctionRuntime)
  runtime?: FunctionRuntime;

  @ApiPropertyOptional({ example: 'index.handler', default: 'index.handler', description: 'Function handler path' })
  @IsOptional()
  @IsString()
  handler?: string;

  @ApiPropertyOptional({ example: 256, default: 256, description: 'Memory allocation in MB' })
  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(1024)
  memory?: number;

  @ApiPropertyOptional({ example: 30, default: 30, description: 'Execution timeout in seconds' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  timeout?: number;

  @ApiPropertyOptional({ example: { NODE_ENV: 'production', LOG_LEVEL: 'debug' }, type: Object, description: 'Environment variables as key-value pairs' })
  @IsOptional()
  @IsObject()
  environment?: Record<string, string>;
}
