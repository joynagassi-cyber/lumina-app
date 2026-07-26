/**
 * Auth Domain — skeleton per ITS-V1
 */

export interface IAuthPort {
  authenticate(credentials: unknown): Promise<unknown>;
  refreshToken(token: string): Promise<unknown>;
  revokeSession(sessionId: string): Promise<boolean>;
}

export class AuthModule {}
