import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MfaVerifyDto {
  @ApiProperty({ example: '123456', description: 'TOTP verification code' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP', description: 'MFA secret key' })
  @IsString()
  secret: string;
}
