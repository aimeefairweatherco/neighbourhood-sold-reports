<script lang="ts">
	import { onMount } from 'svelte';
	import { useGoogleMapsRoot } from '../google-maps.svelte.js';
	import type { GoogleMapsRootProps } from '../types.js';

	let {
		libraries,
		apiKey = 'AIzaSyDCFKEVZR8HDXe7EWhCg4Ijl00mrWCCmt8',
		region = 'CA',
		version = 'weekly',
		children
	}: GoogleMapsRootProps = $props();

	const googleMapsApi = useGoogleMapsRoot({
		apiKey,
		libraries,
		region,
		version
	});

	onMount(async () => {
		// Prevent attempting to load the API on the server.
		//Need access to window object

		googleMapsApi.loadLibraries();
	});
</script>

{#if googleMapsApi.status.current === 'loaded'}
	{@render children?.()}
{:else if googleMapsApi.status.current === 'error'}
	<p>Failed to load google maps</p>
{:else}
	<p>Loading google maps...</p>
{/if}
