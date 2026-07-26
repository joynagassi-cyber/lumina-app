import { NestMiddleware } from "@nestjs/common";

/**
 * Base middleware skeleton — request logging and CORS handling.
 */
export class BaseMiddleware implements NestMiddleware {
  use(_request: Request, _response: Response, _next: () => void) {
    _next();
  }
}
