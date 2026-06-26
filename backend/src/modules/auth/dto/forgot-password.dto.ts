import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ravi@example.com', description: 'User email address' })
  @IsEmail()
  email: string;
}
