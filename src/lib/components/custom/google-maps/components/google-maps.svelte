<script lang="ts">
	import { useApiProvider } from '../google-maps.svelte.js';
	import type { ApiProviderProps } from '../types.js';
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
	}: ApiProviderProps = $props();

	const apiProvider = useApiProvider({
		apiKey,
		region,
		version,
		libraries,
		authReferrerPolicy,
		language,
		onError
	});
</script>

{#if apiProvider.isFullyLoaded}
	{@render children?.()}
{:else}
	<p>Loading google maps...</p>
{/if}
