import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const apiPrefix = process.env.API_PREFIX || 'api';
  const port = parseInt(process.env.PORT ?? '4000', 10) || 4000;
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new LoggingInterceptor());

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    exposedHeaders: ['x-request-id'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VrixoBase API')
    .setDescription('Supabase alternative - Backend API. Full-featured backend-as-a-service with authentication, database, storage, serverless functions, realtime subscriptions, and more.')
    .setVersion('0.1.0')
    .setContact('VrixoBase Team', 'https://vrixobase.com', 'support@vrixobase.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token (auto-refreshed by Swagger plugin)',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'API key for programmatic access (bypasses JWT auth)',
      },
      'ApiKey-auth',
    )
    .addTag('Auth', 'Authentication - register, login, OAuth, MFA, password management')
    .addTag('Projects', 'Project management - CRUD operations for your projects')
    .addTag('Database', 'Database operations - tables, columns, queries, schema management')
    .addTag('Storage', 'File storage - buckets, files, uploads, signed URLs')
    .addTag('Functions', 'Serverless functions - deploy, execute, manage webhooks')
    .addTag('Realtime', 'Realtime subscriptions - live data sync, presence, WebSocket connections')
    .addTag('Monitoring', 'Monitoring - database, API, storage, and error metrics')
    .addTag('Security', 'Security settings - RLS policies, secrets management')
    .addTag('Team', 'Team management - members, roles, invitations')
    .addTag('Audit', 'Audit logs - track changes and access patterns')
    .addTag('API Keys', 'API key management for programmatic access')
    .addTag('API Generator', 'Auto-generated REST API for your database tables')
    .addTag('Health', 'Health check endpoint')
    .build();

  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/swagger-plugin' });

  const swaggerPath = `/${apiPrefix}/docs`;

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  document.components = document.components || {};
  document.components.schemas = {
    ...document.components.schemas,
    SuccessResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'object', nullable: true },
        timestamp: { type: 'string', format: 'date-time', example: '2026-06-25T12:00:00.000Z' },
        path: { type: 'string', example: '/api/projects' },
      },
    },
    ErrorResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' }, example: ['Validation failed'] },
        error: { type: 'string', example: 'Bad Request' },
        timestamp: { type: 'string', format: 'date-time' },
        path: { type: 'string' },
      },
    },
    PaginatedResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: { type: 'object' } },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 100 },
            page: { type: 'number', example: 1 },
            pageSize: { type: 'number', example: 10 },
            totalPages: { type: 'number', example: 10 },
            hasNextPage: { type: 'boolean', example: true },
            hasPreviousPage: { type: 'boolean', example: false },
          },
        },
        timestamp: { type: 'string', format: 'date-time' },
        path: { type: 'string' },
      },
    },
  };

  SwaggerModule.setup(swaggerPath, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      syntaxHighlight: { activated: true, theme: 'monokai' },
      tryItOutEnabled: true,
      displayRequestDuration: true,
      filter: true,
    },
    customSiteTitle: 'VrixoBase API Docs',
    customJs: '/swagger-plugin/swagger-auth-refresh.js',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-size: 28px }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .opblock-tag { font-size: 16px }
      .swagger-ui .opblock .opblock-summary-description { font-size: 13px }
    `,
  });

  await app.listen(port);
  logger.log(`Application is running on http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger docs available at http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap();
