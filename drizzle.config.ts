import { type Config } from 'drizzle-kit';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { envSchema } from './env.ts';

// This is a workaround for the fact that Deno doesn't support top level await
// See https://github.com/drizzle-team/drizzle-orm/issues/1982
const require = createRequire(import.meta.url);

const SECRETS = execSync(
   `deno run --allow-read --allow-env --allow-net --env ${
      require.resolve('./drizzle-secrets.ts')
   }`,
   { encoding: 'utf8' },
).trim();

const ENV = JSON.parse(SECRETS);

envSchema.parse(ENV);

export default {
   schema: './packages/db/schema.ts',
   out: './packages/db/migrations',
   dialect: 'turso',
   dbCredentials: {
      url: ENV.TURSO_DATABASE_URL,
      authToken: ENV.TURSO_AUTH_TOKEN,
   },
} satisfies Config;
