import { createClient } from '@1password/sdk';
import { env as currentEnv } from 'node:process';

import type { infer as zInfer, ZodSchema } from 'zod';

export async function loadEnv<T extends ZodSchema>(
	envSchema: T,
	envValues?: Record<string, string>
): Promise<zInfer<T>> {
	const token = currentEnv.OP_SERVICE_ACCOUNT_TOKEN;

	if (!token) {
		throw new Error('OP_SERVICE_ACCOUNT_TOKEN environment variable is required');
	}

	const { data: parsedEnv, error } = envSchema.safeParse(envValues);

	if (error) {
		console.error('Invalid .env file:');
		console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
		process.exit(0);
	}

	const client = await createClient({
		auth: token,
		integrationName: 'Neighbourhood Sold Reports',
		integrationVersion: '1.0.0'
	});

	const env: zInfer<T> = {};

	for (const envKey of Object.keys(parsedEnv)) {
		const secretPath = parsedEnv[envKey];
		if (secretPath) {
			try {
				const secret = await client.secrets.resolve(secretPath);
				env[envKey] = secret;
			} catch (e) {
				console.error(`Error fetching secret: ${envKey}`);
				console.error(e);
				process.exit(0);
			}
		}
	}
	return env;
}
