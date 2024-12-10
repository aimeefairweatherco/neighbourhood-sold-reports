import * as dotEnv from '$env/static/private';
import { loadEnv } from './op.js';
import { z } from 'zod';

const envSchema = z.object({
	PRIVATE_TURSO_DATABASE_URL: z.string(),
	PRIVATE_TURSO_AUTH_TOKEN: z.string()
});

export const env = await loadEnv(envSchema, dotEnv);
