<script lang="ts">
	import { useGoogleMapsMap } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsMapProps } from '../types.js';

	let {
		mapId = useId('maps'),
		config = {
			zoom: 12,
			center: { lat: 43.653226, lng: -79.383184 },
			mapTypeControl: false,
			fullscreenControl: false,
			streetViewControl: false
		},
		children,
		...restProps
	}: GoogleMapsMapProps = $props();

	function initMap(container: HTMLDivElement) {
		const map = useGoogleMapsMap({
			container,
			mapId,
			config
		});
	}
</script>

<div use:initMap id={mapId} {...restProps}>
	{@render children?.()}
</div>
