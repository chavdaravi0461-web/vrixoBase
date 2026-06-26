import { IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ExecuteFunctionDto {
  @ApiPropertyOptional({ example: { userId: 123, action: 'trigger' }, type: Object, description: 'Payload to pass to the function' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
