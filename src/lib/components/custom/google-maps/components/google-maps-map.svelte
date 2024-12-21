<script lang="ts">
	import { useMap } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { MapProps } from '../types.js';

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
	}: MapProps = $props();

	let isMapMounted = $state(false);

	function mountMap(node: HTMLDivElement) {
		useMap({
			mapDiv: node,
			mapId: id || useId('map'),
			opts
		});

		isMapMounted = true;
	}
</script>

<div use:mountMap {id} {...restProps}>
	{#if isMapMounted}
		{@render children?.()}
	{/if}
</div>
