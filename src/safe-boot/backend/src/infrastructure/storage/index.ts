/**
 * Storage infrastructure — file/object storage adapter skeleton.
 */

import { Injectable } from "@nestjs/common";

@Injectable()
export class StorageAdapter {
  upload(_key: string, _data: Buffer): Promise<string> {
    return Promise.resolve("");
  }

  download(_key: string): Promise<Buffer> {
    return Promise.resolve(Buffer.from(""));
  }
}
