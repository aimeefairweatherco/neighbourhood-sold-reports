<script lang="ts" module>
	import type { ZodObject } from 'zod';
	type T = unknown;
</script>

<script lang="ts" generics="T extends ZodObject<any>">
	import { useMarkerLayer } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { MarkerLayerProps, Marker } from '../types.js';
	import { watch } from 'runed';
	import { z } from 'zod';

	let {
		visible = $bindable<boolean>(true),
		name = useId('Marker Layer'),
		id = useId('markerLayer'),
		attributeSchema = z.object({}) as T,
		children,
		filter = $bindable<(feature: Marker<T>) => boolean>(),
		...restProps
	}: MarkerLayerProps<T> = $props();

	const markerLayerState = useMarkerLayer({ id, visible, name, attributeSchema });

	watch(
		() => visible,
		(curr, prev) => {
			if (curr !== prev) {
				markerLayerState.visible = curr;
			}
		}
	);

	watch(
		() => filter,
		() => {
			markerLayerState.setFilter(filter);
		}
	);
</script>

{#if markerLayerState.apiProvider.isFullyLoaded}
	{@render children?.({ attributeSchema })}
{/if}
