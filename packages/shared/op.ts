import { createClient } from "@1password/sdk";
import { load } from "@std/dotenv";
import { z } from "zod";

export async function loadEnv<T extends z.ZodSchema>(
   envSchema: T,
): Promise<z.infer<T>> {
   const envVar = await load({ export: true });

   const token = Deno.env.get("OP_SERVICE_ACCOUNT_TOKEN");

   if (!token) {
      throw new Error(
         "OP_SERVICE_ACCOUNT_TOKEN environment variable is required",
      );
   }

   const client = await createClient({
      auth: token,
      integrationName: "Neighbourhood Sold Reports",
      integrationVersion: "1.0.0",
   });

   validateEnvFile(envSchema, envVar);

   const env: z.infer<T> = {};

   for (const envKey of Object.keys(envVar)) {
      const secretPath = envVar[envKey];
      if (secretPath) {
         const secret = await client.secrets.resolve(secretPath);
         env[envKey] = secret;
      }
   }
   console.log(env);
   return env;
}

function validateEnvFile(
   envSchema: z.ZodSchema,
   envObject: Record<string, string>,
) {
   const { data: env, error } = envSchema.safeParse(envObject);

   if (error) {
      console.error("Invalid .env file:");
      console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
      Deno.exit(0);
   }
}
