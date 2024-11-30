import { google } from 'googleapis';
import type { JWT } from 'googleapis/auth';
import env from '@/env.ts';

export async function getAuth(): Promise<JWT> {
   const pk = env.GOOGLE_SERVICE_ACCOUNT_PK.replace(/\\n/g, '\n');
   const auth = new google.auth.JWT({
      email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: pk,
      scopes: [
         'https://www.googleapis.com/auth/drive',
      ],
   });

   return auth;
}
