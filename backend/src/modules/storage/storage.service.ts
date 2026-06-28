import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireProjectMembership } from '../../common/authorization/helpers';
import { RlsPolicyEngineService } from '../rls/rls-policy-engine.service';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import sharp from 'sharp';
import { Readable } from 'stream';

function sanitizePath(input: string, isFolder = false): string {
  const normalized = input.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const sanitized: string[] = [];
  for (const p of parts) {
    if (p === '..') throw new BadRequestException('Path traversal (..) is not allowed');
    if (p === '.' || p === '') continue;
    sanitized.push(p.replace(/[^a-zA-Z0-9._-]/g, '_'));
  }
  if (sanitized.length === 0) throw new BadRequestException('Invalid path');
  const result = sanitized.join('/');
  return isFolder ? result + '/' : result;
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export interface StoredFile {
  id: string;
  bucketId: string;
  name: string;
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  isPublic: boolean;
  uploadedById: string;
  createdAt: Date;
}

export interface ImageOptimizeOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client;
  private readonly bucketPrefix: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rlsPolicyEngine: RlsPolicyEngineService,
  ) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(this.configService.get<string>('MINIO_PORT', '9000')),
      useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.bucketPrefix = this.configService.get<string>('MINIO_BUCKET_PREFIX', 'vrixo');
  }

  private getBucketName(projectId: string, bucketId: string): string {
    return `${this.bucketPrefix}-${projectId}-${bucketId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  async createBucket(projectId: string, name: string, isPublic: boolean, allowedMimeTypes?: string[], maxFileSize?: number) {
    const existing = await this.prisma.bucket.findFirst({
      where: { projectId, name },
    });
    if (existing) {
      throw new ConflictException(`Bucket "${name}" already exists in this project`);
    }

    const bucket = await this.prisma.bucket.create({
      data: {
        projectId,
        name,
        isPublic,
        allowedMimeTypes: allowedMimeTypes ? JSON.stringify(allowedMimeTypes) : null,
        maxFileSize: maxFileSize ?? null,
      },
    });

    const minioBucketName = this.getBucketName(projectId, bucket.id);
    const exists = await this.minioClient.bucketExists(minioBucketName);
    if (!exists) {
      await this.minioClient.makeBucket(minioBucketName);
      if (isPublic) {
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${minioBucketName}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(minioBucketName, JSON.stringify(policy));
      }
    }

    this.logger.log(`Bucket created: ${name} (${bucket.id})`);
    return bucket;
  }

  async deleteBucket(id: string, userId?: string) {
    const bucket = await this.prisma.bucket.findUnique({ where: { id } });
    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    await requireProjectMembership(this.prisma, bucket.projectId, userId);

    const files = await this.prisma.file.findMany({ where: { bucketId: id } });
    const minioBucketName = this.getBucketName(bucket.projectId, bucket.id);

    for (const file of files) {
      try {
        await this.minioClient.removeObject(minioBucketName, file.path);
      } catch (err) {
        this.logger.warn(`Failed to remove file ${file.path} from MinIO: ${err.message}`);
      }
    }

    try {
      await this.minioClient.removeBucket(minioBucketName);
    } catch (err) {
      this.logger.warn(`Failed to remove bucket ${minioBucketName} from MinIO: ${err.message}`);
    }

    await this.prisma.file.deleteMany({ where: { bucketId: id } });
    await this.prisma.bucket.delete({ where: { id } });

    this.logger.log(`Bucket deleted: ${bucket.name} (${id})`);
    return { message: 'Bucket deleted successfully' };
  }

  async listBuckets(projectId: string) {
    return this.prisma.bucket.findMany({
      where: { projectId },
      include: { _count: { select: { files: true } } },
    });
  }

  async uploadFile(bucketId: string, file: Express.Multer.File, isPublic: boolean, userId?: string) {
    if (!userId) {
      throw new BadRequestException('User authentication required to upload files');
    }

    const bucket = await this.prisma.bucket.findUnique({ where: { id: bucketId } });
    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    await requireProjectMembership(this.prisma, bucket.projectId, userId);

    if (bucket.allowedMimeTypes) {
      const allowed: string[] = JSON.parse(bucket.allowedMimeTypes);
      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException(
          `MIME type ${file.mimetype} is not allowed. Allowed: ${allowed.join(', ')}`,
        );
      }
    }

    if (bucket.maxFileSize && file.size > bucket.maxFileSize) {
      throw new BadRequestException(
        `File size ${file.size} exceeds maximum of ${bucket.maxFileSize}`,
      );
    }

    const uuid = uuidv4();
    const sanitizedOriginal = sanitizeFilename(file.originalname);
    const fileStorageName = `${uuid}-${sanitizedOriginal}`;
    const objectPath = `${bucket.projectId}/${bucketId}/${fileStorageName}`;

    const minioBucketName = this.getBucketName(bucket.projectId, bucket.id);

    await this.minioClient.putObject(minioBucketName, objectPath, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    const fileRecord = await this.prisma.file.create({
      data: {
        bucketId,
        name: objectPath,
        originalName: sanitizedOriginal,
        mimeType: file.mimetype,
        size: file.size,
        path: objectPath,
        isPublic: bucket.isPublic || isPublic,
        uploadedById: userId,
      },
    });

    this.logger.log(`File uploaded: ${sanitizedOriginal} -> ${objectPath}`);
    return fileRecord;
  }

  async deleteFile(id: string, userId?: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const bucket = await this.prisma.bucket.findUnique({ where: { id: file.bucketId } });
    if (!bucket) throw new NotFoundException('Bucket not found');
    await requireProjectMembership(this.prisma, bucket.projectId, userId);
    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    const minioBucketName = this.getBucketName(bucket.projectId, bucket.id);

    try {
      await this.minioClient.removeObject(minioBucketName, file.path);
    } catch (err) {
      this.logger.warn(`Failed to remove file from MinIO: ${err.message}`);
    }

    await this.prisma.file.delete({ where: { id } });
    this.logger.log(`File deleted: ${file.originalName} (${id})`);
    return { message: 'File deleted successfully' };
  }

  async getFile(id: string, userId?: string): Promise<StoredFile | null> {
    const file = await this.prisma.file.findUnique({
      where: { id },
      include: { bucket: { select: { projectId: true } } },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    await requireProjectMembership(this.prisma, file.bucket.projectId, userId);
    const { bucket, ...fileData } = file;
    return fileData as StoredFile;
  }

  async listFiles(bucketId: string, prefix?: string, userId?: string) {
    const bucket = await this.prisma.bucket.findUnique({ where: { id: bucketId } });
    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    await requireProjectMembership(this.prisma, bucket.projectId, userId);

    const where: any = { bucketId };
    if (prefix) {
      where.path = { startsWith: prefix };
    }

    return this.prisma.file.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async getSignedUrl(fileId: string, expiresIn: number = 3600, userId?: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const bucket = await this.prisma.bucket.findUnique({ where: { id: file.bucketId } });
    if (!bucket) throw new NotFoundException('Bucket not found');
    await requireProjectMembership(this.prisma, bucket.projectId, userId);
    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    const minioBucketName = this.getBucketName(bucket.projectId, bucket.id);

    const url = await this.minioClient.presignedGetObject(minioBucketName, file.path, expiresIn);
    return { url, expiresIn };
  }

  async getPublicUrl(fileId: string, userId?: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const bucket = await this.prisma.bucket.findUnique({ where: { id: file.bucketId } });
    if (!bucket) throw new NotFoundException('Bucket not found');
    await requireProjectMembership(this.prisma, bucket.projectId, userId);
    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const useSSL = this.configService.get<boolean>('MINIO_USE_SSL', false);
    const minioBucketName = this.getBucketName(bucket.projectId, bucket.id);
    const protocol = useSSL ? 'https' : 'http';
    const url = `${protocol}://${endpoint}:${port}/${minioBucketName}/${file.path}`;

    return { url };
  }

  async downloadFile(fileId: string, userId?: string): Promise<{ stream: Readable; file: any }> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const bucket = await this.prisma.bucket.findUnique({ where: { id: file.bucketId } });
    if (!bucket) throw new NotFoundException('Bucket not found');
    await requireProjectMembership(this.prisma, bucket.projectId, userId);
    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    const minioBucketName = this.getBucketName(bucket.projectId, bucket.id);
    const stream = await this.minioClient.getObject(minioBucketName, file.path);

    return { stream, file };
  }

  async createFolder(bucketId: string, folderPath: string, userId?: string) {
    const bucket = await this.prisma.bucket.findUnique({ where: { id: bucketId } });
    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }

    await requireProjectMembership(this.prisma, bucket.projectId, userId);

    const safePath = sanitizePath(folderPath, true);
    const markerPath = `${bucket.projectId}/${bucketId}/${safePath}`;
    const minioBucketName = this.getBucketName(bucket.projectId, bucket.id);

    await this.minioClient.putObject(minioBucketName, markerPath, Buffer.alloc(0), 0, {
      'Content-Type': 'application/x-directory',
    });

    this.logger.log(`Folder created: ${safePath}`);
    return { message: 'Folder created successfully', path: safePath };
  }

  async getSignedUploadUrl(
    bucketId: string,
    fileName: string,
    mimeType: string,
    expiresIn: number = 3600,
    userId?: string,
  ) {
    const bucket = await this.prisma.bucket.findUnique({ where: { id: bucketId } });
    if (!bucket) throw new NotFoundException('Bucket not found');

    await requireProjectMembership(this.prisma, bucket.projectId, userId);

    const uuid = uuidv4();
    const sanitized = sanitizeFilename(fileName);
    const objectPath = `${bucket.projectId}/${bucketId}/${uuid}-${sanitized}`;
    const minioBucketName = this.getBucketName(bucket.projectId, bucket.id);

    const url = await this.minioClient.presignedPutObject(minioBucketName, objectPath, expiresIn);

    return { url, objectPath, expiresIn };
  }

  async checkStorageRls(
    projectId: string,
    bucketId: string,
    filePath: string,
    action: 'select' | 'insert' | 'update' | 'delete',
    userId?: string,
  ): Promise<boolean> {
    if (!userId) return bucketId === 'public';

    const policies = await this.prisma.policy.findMany({
      where: {
        projectId,
        tableName: 'files',
        status: 'active',
      },
    });

    if (policies.length === 0) return true;

    const bucket = await this.prisma.bucket.findUnique({ where: { id: bucketId } });
    if (!bucket) return false;

    for (const policy of policies) {
      if (policy.roles.length > 0) {
        const member = await this.prisma.projectMember.findFirst({
          where: { projectId, userId },
        });
        if (!member || !policy.roles.includes(member.role)) {
          continue;
        }
      }

      const def = policy.definition.toLowerCase();
      if (def === 'true' || def === '(true)') continue;
      if (!policy.definition.includes('auth.uid()') && !def.includes('auth.role()')) {
        continue;
      }

      const uidMatch = policy.definition.match(/auth\.uid\(\s*\)\s*=\s*'([^']+)'/);
      if (uidMatch && uidMatch[1] !== userId) return false;

      const roleMatch = policy.definition.match(/auth\.role\(\s*\)\s*=\s*'([^']+)'/);
      if (roleMatch) {
        const member = await this.prisma.projectMember.findFirst({
          where: { projectId, userId },
        });
        if (!member || member.role?.toLowerCase() !== roleMatch[1].toLowerCase()) return false;
      }
    }

    return true;
  }

  async optimizeImage(fileId: string, options: ImageOptimizeOptions, userId?: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.mimeType.startsWith('image/')) {
      throw new BadRequestException('File is not an image');
    }

    const bucket = await this.prisma.bucket.findUnique({ where: { id: file.bucketId } });
    if (!bucket) {
      throw new BadRequestException('Bucket not found');
    }
    await requireProjectMembership(this.prisma, bucket.projectId, userId);

    const minioBucketName = this.getBucketName(bucket.projectId, bucket.id);

    let imageBuffer: Buffer;
    try {
      const stream = await this.minioClient.getObject(minioBucketName, file.path);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      imageBuffer = Buffer.concat(chunks);
    } catch (err) {
      throw new BadRequestException(`Failed to read image from storage: ${err.message}`);
    }

    let pipeline = sharp(imageBuffer);

    if (options.width || options.height) {
      pipeline = pipeline.resize(options.width, options.height, {
        fit: options.fit || 'cover',
        withoutEnlargement: true,
      });
    }

    if (options.format) {
      pipeline = pipeline.toFormat(options.format, { quality: options.quality ?? 80 });
    }

    const optimizedBuffer = await pipeline.toBuffer();

    const ext = options.format || path.extname(file.originalName).replace('.', '') || 'jpeg';
    const optimizedFileName = `${uuidv4()}-optimized.${ext}`;
    const optimizedPath = `${bucket.projectId}/${bucket.id}/${optimizedFileName}`;

    await this.minioClient.putObject(
      minioBucketName,
      optimizedPath,
      optimizedBuffer,
      optimizedBuffer.length,
      { 'Content-Type': `image/${options.format || 'jpeg'}` },
    );

    const optimizedFile = await this.prisma.file.create({
      data: {
        bucketId: file.bucketId,
        name: optimizedPath,
        originalName: `optimized-${file.originalName}`,
        mimeType: `image/${options.format || 'jpeg'}`,
        size: optimizedBuffer.length,
        path: optimizedPath,
        isPublic: file.isPublic,
        uploadedById: userId || 'system',
      },
    });

    this.logger.log(`Image optimized: ${file.originalName} -> ${optimizedPath}`);
    return optimizedFile;
  }
}
