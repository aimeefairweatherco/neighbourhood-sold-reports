import { dirname, fromFileUrl, resolve } from "@std/path";
import { loadEnv } from "@scope/shared/op.ts";
import { z } from "zod";

const envSchema = z.object({
   TURSO_DATABASE_URL: z.string(),
   TURSO_AUTH_TOKEN: z.string(),
});

const _dirname = dirname(fromFileUrl(import.meta.url));
const envFilePath = resolve(_dirname, ".env");

export const env = await loadEnv(envSchema, envFilePath);
