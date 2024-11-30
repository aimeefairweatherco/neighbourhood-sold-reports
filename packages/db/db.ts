import { createClient } from "@libsql/client";
import { env } from "./env.ts";

const turso = createClient({
   url: env.TURSO_DATABASE_URL,
   authToken: env.TURSO_AUTH_TOKEN,
});

export const db = turso;
