<script lang="ts">
	import { useGoogleMapsPolygonLayer } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { PolygonLayerProps } from '../types.js';
	import { polygonDefaultStyles } from '../google-maps.svelte.js';

	let {
		visible = $bindable(true),
		name = useId('Polygon Layer'),
		id = useId('polygonLayer'),
		defaultStyling = polygonDefaultStyles.default,
		hoverStyling = polygonDefaultStyles.hover,
		clickStyling = polygonDefaultStyles.click,
		opts,
		children,
		...restProps
	}: PolygonLayerProps = $props();

	useGoogleMapsPolygonLayer({
		id,
		visible,
		name,
		defaultStyling,
		hoverStyling,
		clickStyling,
		...opts
	});
</script>

{@render children?.()}
