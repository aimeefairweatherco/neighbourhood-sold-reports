<script lang="ts">
	import { useGoogleMapsMap } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsMapProps } from '../types.js';

	let {
		id = useId('map'),
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

	let mapState = $state<ReturnType<typeof useGoogleMapsMap> | null>(null);

	function mount(mapDiv: HTMLDivElement) {
		mapState = useGoogleMapsMap({
			mapId: id || useId('map'),
			mapDiv,
			opts
		});
	}
</script>

<div use:mount {id} {...restProps}>
	{#if mapState?.map}
		{@render children?.()}
	{/if}
</div>
