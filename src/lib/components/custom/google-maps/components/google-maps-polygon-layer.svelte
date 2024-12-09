<script lang="ts">
	import { useGoogleMapsPolygonLayer } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { PolygonLayerProps } from '../types.js';

	let {
		visible = $bindable(true),
		name = useId('Polygon Layer'),
		id = useId('polygonLayer'),
		opts,
		children,
		...restProps
	}: PolygonLayerProps = $props();

	useGoogleMapsPolygonLayer({ id, visible, name, ...opts });
</script>

{@render children?.()}
