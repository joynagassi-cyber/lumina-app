import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";

/**
 * Base interceptor skeleton — response transformation and timing.
 */
@Injectable()
export class BaseInterceptor<T>
  implements NestInterceptor<T, ReturnType<this["handle"]>>
{
  handle(_context: ExecutionContext, _next: CallHandler): Observable<T> {
    return _next.handle();
  }
}
