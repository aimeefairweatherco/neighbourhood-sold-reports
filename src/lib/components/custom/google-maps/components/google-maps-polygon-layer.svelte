<script lang="ts" module>
	import type { ZodObject } from 'zod';
	type T = unknown;
</script>

<script lang="ts" generics="T extends ZodObject<any>">
	import { usePolygonLayer, polygonDefaultStyles } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { PolygonLayerProps, Polygon } from '../types.js';
	import { z } from 'zod';
	import { watch } from 'runed';

	let {
		visible = $bindable(true),
		name = useId('Polygon Layer'),
		id = useId('polygonLayer'),
		attributeSchema = z.object({}) as T,
		//filterFn,
		defaultStyling = polygonDefaultStyles.default,
		hoverStyling = polygonDefaultStyles.hover,
		clickStyling = polygonDefaultStyles.click,
		opts,
		filter = $bindable<(feature: Polygon<T>) => boolean>(),
		children,
		...restProps
	}: PolygonLayerProps<T> = $props();

	const polygonLayerState = usePolygonLayer({
		id,
		visible,
		name,
		opts,
		attributeSchema,
		styling: {
			defaultStyling,
			hoverStyling,
			clickStyling
		}
	});

	$inspect(filter);

	watch(
		() => visible,
		(curr, prev) => {
			if (curr !== prev) {
				polygonLayerState.visible = curr;
			}
		}
	);

	watch(
		() => filter,
		() => {
			polygonLayerState.setFilter(filter);
		}
	);
</script>

{#if polygonLayerState.apiProvider.isFullyLoaded}
	{@render children?.({ attributeSchema })}
{/if}
