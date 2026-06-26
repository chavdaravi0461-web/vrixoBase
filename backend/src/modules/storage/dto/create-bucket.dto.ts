import { IsString, IsBoolean, IsOptional, IsArray, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBucketDto {
  @ApiProperty({ example: 'my-bucket', description: 'Unique bucket name' })
  @IsString()
  name: string;

  @ApiProperty({ example: false, description: 'Whether the bucket is publicly accessible' })
  @IsBoolean()
  isPublic: boolean;

  @ApiPropertyOptional({ type: [String], example: ['image/png', 'application/pdf'], description: 'Allowed MIME types for upload' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedMimeTypes?: string[];

  @ApiPropertyOptional({ example: 10485760, description: 'Maximum file size in bytes' })
  @IsOptional()
  @IsNumber()
  maxFileSize?: number;
}
