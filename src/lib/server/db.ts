import { createClient } from '@libsql/client';
import { env } from './env.js';
import { neighbourhoodSelectSchema, regionSelectSchema } from './schema.js';

const turso = createClient({
	url: env.PRIVATE_TURSO_DATABASE_URL,
	authToken: env.PRIVATE_TURSO_AUTH_TOKEN
});

export const db = turso;

export async function getNeighbourhoods() {
	const neighbourhoods = (await db.execute(`SELECT * FROM neighbourhoods`)).rows;

	const parsed = neighbourhoodSelectSchema.array().parse(neighbourhoods);

	return parsed.map((neighbourhood) => {
		const { polygon_data, ...rest } = neighbourhood;

		return {
			...rest,
			polygon_data: JSON.parse(polygon_data)
		};
	});
}

export async function getRegions() {
	const regions = (await db.execute(`SELECT * FROM regions`)).rows;

	const parsed = regionSelectSchema.array().parse(regions);

	return parsed;
}
