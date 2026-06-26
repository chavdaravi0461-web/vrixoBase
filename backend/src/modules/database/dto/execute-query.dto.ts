import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExecuteQueryDto {
  @ApiProperty({ example: 'SELECT * FROM users', description: 'SQL query' })
  @IsString()
  @IsNotEmpty()
  query: string;
}
