import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiParamOptions,
  ApiQueryOptions,
} from '@nestjs/swagger';

export function ApiAuth() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiBearerAuth('ApiKey-auth'),
  );
}

export function ApiErrorResponses(options?: { conflict?: boolean; notFound?: boolean }) {
  const decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [
    ApiResponse({ status: 400, description: 'Validation error' }),
    ApiResponse({ status: 500, description: 'Internal server error' }),
  ];
  if (options?.notFound) {
    decorators.push(ApiResponse({ status: 404, description: 'Resource not found' }));
  }
  if (options?.conflict) {
    decorators.push(ApiResponse({ status: 409, description: 'Resource conflict' }));
  }
  return applyDecorators(...decorators);
}

export function ApiAuthErrorResponses(options?: { conflict?: boolean; notFound?: boolean }) {
  return applyDecorators(
    ApiResponse({ status: 401, description: 'Unauthorized - invalid or expired token' }),
    ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' }),
    ApiErrorResponses(options),
  );
}

export function ApiOkResponseDoc(type: Type<unknown>, description = 'Success') {
  return ApiOkResponse({ type, description });
}

export function ApiCreatedResponseDoc(type: Type<unknown>, description = 'Created') {
  return ApiCreatedResponse({ type, description });
}

export function ApiParams(params: ApiParamOptions[]) {
  return applyDecorators(...params.map((p) => ApiParam(p)));
}

export function ApiQueries(queries: ApiQueryOptions[]) {
  return applyDecorators(...queries.map((q) => ApiQuery(q)));
}
