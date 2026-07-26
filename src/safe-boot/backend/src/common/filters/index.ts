import { ExceptionFilter, Catch, ArgumentsHost } from "@nestjs/common";

/**
 * Base exception filter — catches all unhandled exceptions.
 * Specific domain filters extend this base.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Placeholder: implement domain-specific logging and response formatting
  }
}
