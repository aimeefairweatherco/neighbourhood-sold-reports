import { google } from "googleapis";
import type { JWT } from "googleapis/auth";
import { createClient } from "@1password/sdk";

export async function getAuth(): Promise<JWT> {
   const secrets = await getSecrets();

   const auth = new google.auth.JWT({
      email: secrets.client_email,
      key: secrets.pk,
      scopes: [
         "https://www.googleapis.com/auth/spreadsheets",
         "https://www.googleapis.com/auth/drive",
      ],
   });

   return auth;
}

async function getSecrets() {
   const token = Deno.env.get("OP_SERVICE_ACCOUNT_TOKEN");

   if (!token) {
      throw new Error(
         "OP_SERVICE_ACCOUNT_TOKEN environment variable is required",
      );
   }

   const client = await createClient({
      auth: token,
      integrationName: "Monthly Market Report",
      integrationVersion: "1.0.0",
   });

   const secretPaths = [
      "op://afco_env/google_service_account/private_key",
      "op://afco_env/google_service_account/client_email",
   ];

   const [private_key, client_email] = await Promise.all(
      secretPaths.map((path) => client.secrets.resolve(path)),
   );

   const pk = private_key.replace(/\\n/g, "\n");

   return {
      pk,
      client_email,
   };
}
