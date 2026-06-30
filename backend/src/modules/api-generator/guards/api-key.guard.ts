import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key. Provide via x-api-key header or Authorization: Bearer <key>');
    }

    const validation = await this.apiKeysService.validateApiKey(apiKey);

    if (!validation) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    if (validation.type === 'PUBLIC' && request.method !== 'GET') {
      throw new UnauthorizedException('Public API keys can only perform read operations');
    }

    const targetProjectId = request.params?.projectId;
    if (targetProjectId && validation.projectId !== targetProjectId) {
      throw new ForbiddenException('API key is not authorized for this project');
    }

    request.projectId = validation.projectId;
    request.apiKeyType = validation.type;
    request.apiKeyPermissions = validation.permissions;
    request.apiKeyId = validation.id;
    request.apiKeyInfo = validation;

    return true;
  }

  private extractApiKey(request: any): string | null {
    const apiKeyHeader = request.headers?.['x-api-key'] || request.headers?.['apikey'];
    if (apiKeyHeader) return apiKeyHeader;

    const auth = request.headers?.['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }

    return null;
  }
}
