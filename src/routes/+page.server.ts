import { getNeighbourhoods, getRegions } from '$lib/server/db.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		neighbourhoods: await getNeighbourhoods(),
		regions: await getRegions()
	};
};
