import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ example: 'images/profile-pics', description: 'Folder path relative to bucket root' })
  @IsString()
  @Matches(/^(?!.*\.\.)[a-zA-Z0-9_\/.-]+$/, {
    message: 'Path must not contain .. traversal and must only use alphanumeric, underscore, hyphen, dot, and forward slash characters',
  })
  path: string;
}
