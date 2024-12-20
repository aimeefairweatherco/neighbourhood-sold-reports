<script lang="ts">
	import { useGoogleMapsMarkerLayer } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { MarkerLayerProps } from '../types.js';
	import { watch } from 'runed';

	let {
		visible = $bindable<boolean>(true),
		name = useId('Marker Layer'),
		id = useId('markerLayer'),
		children,
		...restProps
	}: MarkerLayerProps = $props();

	const markerLayerState = useGoogleMapsMarkerLayer({ id, visible, name });

	watch(
		() => visible,
		(curr, prev) => {
			if (curr !== prev) {
				markerLayerState.visible = curr;
			}
		}
	);
</script>

{#if markerLayerState.apiProvider.isFullyLoaded}
	{@render children?.()}
{/if}
