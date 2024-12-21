<script lang="ts" module>
	import type { ZodObject } from 'zod';
	type T = unknown;
</script>

<script lang="ts" generics="T extends ZodObject<any>">
	import { useMarker } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { MarkerProps } from '../types.js';
	import { z } from 'zod';

	let {
		opts,
		position = $bindable(null),
		attributeSchema = z.object({}) as T,
		attributes = {},
		id = useId('marker'),
		children,
		...restProps
	}: MarkerProps<T> = $props();

	const markerState = useMarker({
		id,
		attributes,
		attributeSchema,
		markerOpts: { position, ...opts }
	});
</script>

{@render children?.()}
