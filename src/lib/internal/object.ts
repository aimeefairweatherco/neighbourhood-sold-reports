/**
 * Performs a deep comparison between two flat objects.
 * @param obj1 - The first object to compare.
 * @param obj2 - The second object to compare.
 * @returns `true` if both objects are deeply equal, otherwise `false`.
 */
export function deepEqual(obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean {
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	if (keys1.length !== keys2.length) {
		return false;
	}

	for (const key of keys1) {
		if (!Object.prototype.hasOwnProperty.call(obj2, key)) {
			return false;
		}

		const val1 = obj1[key];
		const val2 = obj2[key];

		// Check for strict equality
		if (val1 !== val2) {
			return false;
		}
	}

	return true;
}
