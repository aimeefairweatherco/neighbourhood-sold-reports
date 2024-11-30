import { dirname, fromFileUrl, resolve } from "@std/path";
import { loadEnv } from "@scope/shared/op.ts";
import { z } from "zod";

const envSchema = z.object({
   GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string(),
   GOOGLE_SERVICE_ACCOUNT_PK: z.string(),
});

const _dirname = dirname(fromFileUrl(import.meta.url));
const envFilePath = resolve(_dirname, ".env");

export const env = await loadEnv(envSchema, envFilePath);
