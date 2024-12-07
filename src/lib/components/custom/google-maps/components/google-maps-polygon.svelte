<script lang="ts">
	import { useGoogleMapsPolygon } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsPolygonProps } from '../types.js';

	let {
		opts,
		visible = $bindable(true),
		id = useId('polygon'),
		children,
		...restProps
	}: GoogleMapsPolygonProps = $props();

	useGoogleMapsPolygon({ id, visible, ...opts });
</script>

{@render children?.()}
