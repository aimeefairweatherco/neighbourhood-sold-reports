<script lang="ts">
	import { useGoogleMapsDataLayer } from '../google-maps.svelte.js';
	import { useId } from '$lib/internal/use-id';
	import type { GoogleMapsDataLayerProps } from '../types.js';

	let {
		opts,
		visible = $bindable(true),
		id = useId('dataLayer'),
		children,
		...restProps
	}: GoogleMapsDataLayerProps = $props();

	useGoogleMapsDataLayer({ id, visible, ...opts });
</script>

{@render children?.()}
