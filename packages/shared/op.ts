import { createClient } from "@1password/sdk";
import { load } from "@std/dotenv";
import type { infer as zInfer, ZodSchema } from "zod";

export async function loadEnv<T extends ZodSchema>(
   envSchema: T,
   envFilePath?: string,
): Promise<zInfer<T>> {
   const envVars = envFilePath
      ? await load({
         envPath: envFilePath,
      })
      : await load();

   const token = Deno.env.get("OP_SERVICE_ACCOUNT_TOKEN");

   if (!token) {
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
      auth: token,
      integrationName: "Neighbourhood Sold Reports",
      integrationVersion: "1.0.0",
   });

   const env: zInfer<T> = {};

   for (const envKey of Object.keys(parsedEnv)) {
      const secretPath = parsedEnv[envKey];
      if (secretPath) {
         const secret = await client.secrets.resolve(secretPath);
         env[envKey] = secret;
      }
   }

   return env;
}
