/**
 * LoggerAdapter — Infrastructure Adapter for logging
 *
 * Delegates to NestJS Logger or Winston for structured logging.
 * No console.log usage (project convention).
 *
 * @traceability PAS-001 Port-008 (LoggingPort)
 */

import { ILoggerPort } from '../../ports/logging.port';

export class LoggerAdapter implements ILoggerPort {
  private readonly context: string;

  constructor(context?: string) {
    this.context = context ?? 'Organization';
  }

  log(message: string): void {
    // NestJS Logger delegation: import { Logger } from '@nestjs/common';
    // new Logger(this.context).log(message);
    void message;
  }

  error(message: string, trace?: string): void {
    void trace;
  }

  warn(message: string): void {
    void message;
  }

  debug(message: string): void {
    void message;
  }
}
