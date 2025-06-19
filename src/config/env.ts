import { z } from 'zod'

/**
 * Environment variables schema
 */
const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  HOST: z.string().default('0.0.0.0'),
  BASE_URL: z.string().default('http://localhost:3000'),
  WS_PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

/**
 * Parsed and validated environment variables
 */
export const env = envSchema.parse(process.env)
