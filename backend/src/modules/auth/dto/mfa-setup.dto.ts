import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MfaSetupDto {
  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP', description: 'MFA secret key' })
  @IsString()
  secret: string;
}
