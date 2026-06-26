import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { StorageService, StoredFile } from './storage.service';
import { CreateBucketDto } from './dto/create-bucket.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('Storage')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get(':projectId/buckets')
  @ApiOperation({ summary: 'List all buckets for a project' })
  @ApiParam({ name: 'projectId', type: String })
  async listBuckets(@Param('projectId') projectId: string) {
    return this.storageService.listBuckets(projectId);
  }

  @Post(':projectId/buckets')
  @ApiOperation({ summary: 'Create a new storage bucket' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: CreateBucketDto })
  async createBucket(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBucketDto,
  ) {
    return this.storageService.createBucket(
      projectId,
      dto.name,
      dto.isPublic,
      dto.allowedMimeTypes,
      dto.maxFileSize,
    );
  }

  @Delete('buckets/:id')
  @ApiOperation({ summary: 'Delete a bucket and all its files' })
  @ApiParam({ name: 'id', type: String })
  async deleteBucket(@Param('id') id: string, @Req() req?: any) {
    return this.storageService.deleteBucket(id, req?.user?.id);
  }

  @Post('buckets/:bucketId/upload')
  @ApiOperation({ summary: 'Upload a file to a bucket' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'bucketId', type: String })
  @ApiQuery({ name: 'isPublic', required: false, type: Boolean })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        isPublic: { type: 'boolean' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('bucketId') bucketId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('isPublic') isPublic?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id;
    return this.storageService.uploadFile(
      bucketId,
      file,
      isPublic === 'true',
      userId,
    );
  }

  @Delete('files/:id')
  @ApiOperation({ summary: 'Delete a file' })
  @ApiParam({ name: 'id', type: String })
  async deleteFile(@Param('id') id: string, @Req() req?: any) {
    return this.storageService.deleteFile(id, req?.user?.id);
  }

  @Get('files/:id')
  @ApiOperation({ summary: 'Get file metadata' })
  @ApiParam({ name: 'id', type: String })
  async getFile(@Param('id') id: string, @Req() req?: any): Promise<StoredFile | null> {
    return this.storageService.getFile(id, req?.user?.id);
  }

  @Get('buckets/:bucketId/files')
  @ApiOperation({ summary: 'List files in a bucket' })
  @ApiParam({ name: 'bucketId', type: String })
  @ApiQuery({ name: 'prefix', required: false, type: String })
  async listFiles(
    @Param('bucketId') bucketId: string,
    @Query('prefix') prefix?: string,
    @Req() req?: any,
  ) {
    return this.storageService.listFiles(bucketId, prefix, req?.user?.id);
  }

  @Get('files/:id/signed-url')
  @ApiOperation({ summary: 'Get a signed URL for a private file' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'expiresIn', required: false, type: Number })
  async getSignedUrl(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: string,
    @Req() req?: any,
  ) {
    return this.storageService.getSignedUrl(id, expiresIn ? parseInt(expiresIn, 10) : 3600, req?.user?.id);
  }

  @Get('files/:id/public-url')
  @ApiOperation({ summary: 'Get a public URL for a file' })
  @ApiParam({ name: 'id', type: String })
  async getPublicUrl(@Param('id') id: string, @Req() req?: any) {
    return this.storageService.getPublicUrl(id, req?.user?.id);
  }

  @Get('files/:id/download')
  @ApiOperation({ summary: 'Download a file stream' })
  @ApiParam({ name: 'id', type: String })
  async downloadFile(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req?: any,
  ) {
    const { stream, file } = await this.storageService.downloadFile(id, req?.user?.id);
    const safeFilename = file.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', file.size);
    stream.pipe(res);
  }

  @Post('buckets/:bucketId/folders')
  @ApiOperation({ summary: 'Create a folder in a bucket' })
  @ApiParam({ name: 'bucketId', type: String })
  @ApiBody({ type: CreateFolderDto })
  async createFolder(
    @Param('bucketId') bucketId: string,
    @Body() dto: CreateFolderDto,
    @Req() req?: any,
  ) {
    return this.storageService.createFolder(bucketId, dto.path, req?.user?.id);
  }
}
