<script lang="ts">
	import { useGoogleMapsApiProvider } from '../google-maps.svelte.js';
	import type { GoogleMapsRootProps } from '../types.js';
	import { noop } from '$lib/internal/noop.js';

	let {
		libraries,
		apiKey,
		region = 'CA',
		version = 'weekly',
		authReferrerPolicy,
		language,
		onError = noop,
		children
	}: GoogleMapsRootProps = $props();

	const apiProvider = useGoogleMapsApiProvider({
		apiKey,
		region,
		version,
		libraries,
		authReferrerPolicy,
		language,
		onError
	});
</script>

{#await apiProvider}
	<p>Loading google maps...</p>
{:then}
	{@render children?.()}
{:catch error}
	<p>Error loading google maps: {error.message}</p>
{/await}
