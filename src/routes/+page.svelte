<script lang="ts">
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Menubar from '$lib/components/shadcn/menubar/menubar.svelte';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import * as Sheet from '$lib/components/shadcn/sheet/index.js';

	import * as Maps from '$lib/components/custom/google-maps/index.js';
</script>

<div class="w-100[dvw] h-[100dvh] overflow-hidden">
	<Maps.Root libraries={['maps', 'marker']}
		><Maps.Map class="h-full w-full"
			><Maps.Marker
				opts={{
					position: { lat: 43.730091, lng: -79.399199 }
				}}
			></Maps.Marker></Maps.Map
		></Maps.Root
	>
</div>
