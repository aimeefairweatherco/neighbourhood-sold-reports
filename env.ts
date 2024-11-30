import { createClient } from "@1password/sdk";
import { z } from "zod";

export const envSchema = z.object({
   GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string(),
   GOOGLE_SERVICE_ACCOUNT_PK: z.string(),
   TURSO_DATABASE_URL: z.string(),
   TURSO_AUTH_TOKEN: z.string(),
});

export async function loadEnv<T extends z.ZodSchema>(
   envSchema: T,
): Promise<z.infer<T>> {
   const envVars = Deno.env.toObject();

   if (!envVars.OP_SERVICE_ACCOUNT_TOKEN) {
      throw new Error(
         "OP_SERVICE_ACCOUNT_TOKEN environment variable is required",
      );
   }

   const { data: parsedEnv, error } = envSchema.safeParse(envVars);

   if (error) {
      console.error("Invalid .env file:");
      console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
      Deno.exit(0);
   }

   const client = await createClient({
      auth: envVars.OP_SERVICE_ACCOUNT_TOKEN,
      integrationName: "Neighbourhood Sold Reports",
      integrationVersion: "1.0.0",
   });

   const env: z.infer<T> = {};

   for (const envKey of Object.keys(parsedEnv)) {
      const secretPath = parsedEnv[envKey];
      try {
         const secret = await client.secrets.resolve(secretPath);
         env[envKey] = secret;
      } catch (err) {
         console.error(
            `Error resolving secret for ${envKey}: ${secretPath}`,
            err,
         );
         Deno.exit(0);
      }
   }

   return env;
}

export const env = loadEnv(envSchema);
