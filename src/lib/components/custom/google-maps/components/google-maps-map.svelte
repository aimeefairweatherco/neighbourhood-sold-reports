<script lang="ts">
	import { useGoogleMapsMap } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsMapProps } from '../types.js';

	let {
		id,
		opts = {
			zoom: 12,
			center: { lat: 43.653226, lng: -79.383184 },
			mapTypeControl: false,
			fullscreenControl: false,
			streetViewControl: false
		},
		children,
		...restProps
	}: GoogleMapsMapProps = $props();

	let isMapMounted = $state(false);

	function mountMap(node: HTMLDivElement) {
		useGoogleMapsMap({
			mapDiv: node,
			mapId: id || useId('map'),
			opts
		}).then(() => {
			isMapMounted = true;
		});
	}
</script>

<div use:mountMap {id} {...restProps}>
	{#if isMapMounted}
		{@render children?.()}
	{/if}
</div>
