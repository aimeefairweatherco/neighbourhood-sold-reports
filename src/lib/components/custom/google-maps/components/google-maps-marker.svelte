<script lang="ts">
	import { useGoogleMapsMarker } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsMarkerProps } from '../types.js';

	let {
		opts,
		attributes = null,
		visible = $bindable(true),
		id = useId('marker'),
		children,
		...restProps
	}: GoogleMapsMarkerProps = $props();

	useGoogleMapsMarker({ id, visible, ...opts });
</script>

{@render children?.()}
