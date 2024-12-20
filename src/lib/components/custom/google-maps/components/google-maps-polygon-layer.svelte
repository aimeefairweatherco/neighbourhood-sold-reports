<script lang="ts">
	import { useGoogleMapsPolygonLayer } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { PolygonLayerProps } from '../types.js';
	import { polygonDefaultStyles } from '../google-maps.svelte.js';
	import { watch } from 'runed';

	let {
		visible = $bindable(true),
		name = useId('Polygon Layer'),
		id = useId('polygonLayer'),
		//filterFn,
		defaultStyling = polygonDefaultStyles.default,
		hoverStyling = polygonDefaultStyles.hover,
		clickStyling = polygonDefaultStyles.click,
		opts,
		children,
		...restProps
	}: PolygonLayerProps = $props();

	const polygonLayerState = useGoogleMapsPolygonLayer({
		id,
		visible,
		name,
		opts,
		styling: {
			defaultStyling,
			hoverStyling,
			clickStyling
		}
	});

	watch(
		() => visible,
		(curr, prev) => {
			if (curr !== prev) {
				polygonLayerState.visible = curr;
			}
		}
	);
</script>

{#await polygonLayerState then}
	{@render children?.()}
{:catch error}
	<p>Error loading google maps: {error.message}</p>
{/await}
