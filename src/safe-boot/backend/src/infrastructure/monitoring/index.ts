/**
 * Monitoring infrastructure — metrics and health check skeleton.
 */

import { Injectable } from "@nestjs/common";

@Injectable()
export class MonitoringAdapter {
  trackEvent(_name: string, _data: Record<string, unknown>): void {
    // TODO: Implement telemetry export
  }

  healthCheck(): Promise<Record<string, string>> {
    return Promise.resolve({ status: "ok" });
  }
}
