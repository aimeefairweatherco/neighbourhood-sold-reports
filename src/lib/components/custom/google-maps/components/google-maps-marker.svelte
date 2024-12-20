<script lang="ts">
	import { useGoogleMapsMarker } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsMarkerProps } from '../types.js';

	let {
		opts,
		position = $bindable(null),

		id = useId('marker'),
		children,
		...restProps
	}: GoogleMapsMarkerProps = $props();

	const markerState = useGoogleMapsMarker({ id, markerOpts: { position, ...opts } });
</script>

{@render children?.()}
