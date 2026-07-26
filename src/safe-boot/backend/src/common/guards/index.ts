import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

/**
 * Base guard skeleton — all domain guards extend this.
 */
@Injectable()
export class BaseGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // TODO: Implement authorization logic per domain aggregate
    return false;
  }
}
