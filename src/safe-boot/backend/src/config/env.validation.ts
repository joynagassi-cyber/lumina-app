import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  CORS_ORIGIN: Joi.string().optional(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default("7d"),
  SUPABASE_URL: Joi.string().optional(),
  SUPABASE_ANON_KEY: Joi.string().optional(),
});
