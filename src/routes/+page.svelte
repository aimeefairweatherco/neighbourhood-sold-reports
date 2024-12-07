<script lang="ts">
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Menubar from '$lib/components/shadcn/menubar/menubar.svelte';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import * as Sheet from '$lib/components/shadcn/sheet/index.js';

	import * as Maps from '$lib/components/custom/google-maps/index.js';

	const poly = [
		{ lat: 43.812992, lng: -79.243009 },
		{ lat: 43.822264, lng: -79.246994 },
		{ lat: 43.81696, lng: -79.27155 },
		{ lat: 43.810324, lng: -79.30111 },
		{ lat: 43.802315, lng: -79.2975 },
		{ lat: 43.800348, lng: -79.295662 },
		{ lat: 43.795148, lng: -79.293416 },
		{ lat: 43.789718, lng: -79.291009 },
		{ lat: 43.78326, lng: -79.288317 },
		{ lat: 43.774832, lng: -79.284457 },
		{ lat: 43.777097, lng: -79.274679 },
		{ lat: 43.780034, lng: -79.260155 },
		{ lat: 43.783027, lng: -79.245038 },
		{ lat: 43.785382, lng: -79.235375 },
		{ lat: 43.79373, lng: -79.238761 },
		{ lat: 43.795031, lng: -79.239715 },
		{ lat: 43.801714, lng: -79.241881 },
		{ lat: 43.806475, lng: -79.243927 },
		{ lat: 43.808627, lng: -79.243745 },
		{ lat: 43.810821, lng: -79.242756 },
		{ lat: 43.812992, lng: -79.243009 }
	];
</script>

<div class="w-100[dvw] h-[100dvh] overflow-hidden">
	<Maps.Root libraries={['maps']}
		><Maps.Map class="h-full w-full"
			><Maps.Marker geometry={{ lat: 43.730091, lng: -79.399199 }}></Maps.Marker>
			<Maps.DataLayer
				opts={{
					style: {
						fillColor: '#FF0000',
						fillOpacity: 0.35,
						strokeWeight: 1
					}
				}}
			>
				<Maps.Polygon geometry={[poly]}></Maps.Polygon>
			</Maps.DataLayer>
		</Maps.Map></Maps.Root
	>
</div>
