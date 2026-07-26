/**
 * Logging Port
 *
 * Contract for structured logging within the Organization aggregate.
 * Adapters delegate to NestJS Logger or Winston — never console.log.
 *
 * @traceability PAS-001 Port-008 (LoggingPort)
 */

export interface ILoggerPort {
  log(message: string): void;
  error(message: string, trace?: string): void;
  warn(message: string): void;
  debug(message: string): void;
}
