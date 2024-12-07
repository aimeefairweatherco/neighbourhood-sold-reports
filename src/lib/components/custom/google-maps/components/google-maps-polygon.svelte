<script lang="ts">
	import { useGoogleMapsPolygon } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsPolygonProps } from '../types.js';

	let {
		opts,
		initialState = 'visible',
		id = useId('polygon'),
		children,
		...restProps
	}: GoogleMapsPolygonProps = $props();

	useGoogleMapsPolygon({ id, initialState, ...opts });
</script>

{@render children?.()}
