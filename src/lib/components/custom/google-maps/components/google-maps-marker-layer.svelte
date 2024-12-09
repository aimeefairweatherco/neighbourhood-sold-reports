<script lang="ts">
	import { useGoogleMapsMarkerLayer } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { MarkerLayerProps } from '../types.js';

	let {
		visible = $bindable(true),
		name = useId('Marker Layer'),
		id = useId('markerLayer'),
		children,
		...restProps
	}: MarkerLayerProps = $props();

	useGoogleMapsMarkerLayer({ id, visible, name });
</script>

{@render children?.()}
