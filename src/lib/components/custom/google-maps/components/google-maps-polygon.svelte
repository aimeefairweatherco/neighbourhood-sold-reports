<script lang="ts" module>
	import type { ZodObject } from 'zod';
	type T = unknown;
</script>

<script lang="ts" generics="T extends ZodObject<any>">
	import { usePolygon } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { PolygonProps } from '../types.js';
	import { z } from 'zod';

	let {
		id = useId('polygon'),
		geometry,
		attributes = {},
		attributeSchema = z.object({}) as T,
		children,
		...restProps
	}: PolygonProps<T> = $props();

	const polygon = new google.maps.Data.Polygon(geometry);

	const polygonState = usePolygon({
		id,
		attributes,
		attributeSchema,
		opts: {
			geometry: polygon
		}
	});
</script>

{@render children?.()}
