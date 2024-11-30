import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import env from '../../env.ts';
import { z } from 'zod';

const envSchema = z.object({
   TURSO_DATABASE_URL: z.string(),
   TURSO_AUTH_TOKEN: z.string(),
});

const turso = createClient({
   url: env.TURSO_DATABASE_URL,
   authToken: env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(turso);
