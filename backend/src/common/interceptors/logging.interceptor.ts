import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const requestId = uuidv4();
    const now = Date.now();

    request.requestId = requestId;

    this.logger.log(
      `[${requestId}] --> ${method} ${url}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          this.logger.log(
            `[${requestId}] <-- ${method} ${url} ${statusCode} ${Date.now() - now}ms`,
          );
        },
        error: (error) => {
          this.logger.error(
            `[${requestId}] <-- ${method} ${url} ${error.status || 500} ${Date.now() - now}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
