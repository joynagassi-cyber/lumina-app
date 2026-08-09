import { envValidationSchema } from "./env.validation";

export const appConfig = {
  get port(): number {
    return parseInt(process.env.PORT ?? "3000", 10);
  },
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  },
  get databaseUrl(): string {
    return process.env.DATABASE_URL ?? "";
  },
  get jwtSecret(): string {
    return process.env.JWT_SECRET ?? "";
  },
  get jwtExpiration(): string {
    return process.env.JWT_EXPIRATION ?? "7d";
  },
};
