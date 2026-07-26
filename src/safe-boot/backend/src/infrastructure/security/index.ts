/**
 * Security infrastructure — encryption, hashing, and key management skeleton.
 */

import { Injectable } from "@nestjs/common";

@Injectable()
export class SecurityAdapter {
  hash(_value: string): Promise<string> {
    return Promise.resolve("");
  }

  verify(_value: string, _hash: string): Promise<boolean> {
    return Promise.resolve(false);
  }
}
