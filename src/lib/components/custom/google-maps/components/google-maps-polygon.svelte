<script lang="ts">
	import { useGoogleMapsPolygon } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsPolygonProps } from '../types.js';

	let {
		geometry,
		visible = $bindable(true),
		id = useId('polygon'),
		children,
		...restProps
	}: GoogleMapsPolygonProps = $props();

	const polygon = new google.maps.Data.Polygon(geometry);

	useGoogleMapsPolygon({
		id,
		visible,
		geometry: polygon
	});
</script>

{@render children?.()}
