<script lang="ts">
	import { useGoogleMapsPolygon } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsPolygonProps } from '../types.js';

	let {
		geometry,
        
		id = useId('polygon'),
		children,
		...restProps
	}: GoogleMapsPolygonProps = $props();

	const polygon = new google.maps.Data.Polygon(geometry);

	const polygonState = useGoogleMapsPolygon({
		id,

		opts: {
			geometry: polygon
		}
	});
</script>

{@render children?.()}
