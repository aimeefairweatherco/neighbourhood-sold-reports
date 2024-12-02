import { dirname, fromFileUrl, resolve } from "@std/path";
import { loadEnv } from "@scope/shared/op.ts";
import { z } from "zod";

const envSchema = z.object({
   TURSO_DATABASE_URL: z.string(),
   TURSO_AUTH_TOKEN: z.string(),
   PORT: z.coerce.number(),
   NODE_ENV: z.enum(["development", "production"]),
   LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
});

const _dirname = dirname(fromFileUrl(import.meta.url));
const envFilePath = resolve(_dirname, ".env");

export const env = await loadEnv(envSchema, envFilePath);
