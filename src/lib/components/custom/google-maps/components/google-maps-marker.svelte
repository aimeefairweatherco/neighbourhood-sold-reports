<script lang="ts">
	import { useGoogleMapsMarker } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsMarkerProps } from '../types.js';

	let {
		geometry,
		attributes = null,
		visible = $bindable(true),
		id = useId('marker'),
		children,
		...restProps
	}: GoogleMapsMarkerProps = $props();

	useGoogleMapsMarker({ id, visible, geometry, properties: attributes });
</script>

{@render children?.()}
