<script lang="ts">
	import type { PageData } from './$types';
	import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$env/static/public';
	import { Button } from '$lib/components/shadcn/button/index.js';
	import { Badge } from '$lib/components/shadcn/badge/index.js';
	import { Input } from '$lib/components/shadcn/input/index.js';
	import * as Card from '$lib/components/shadcn/card/index.js';
	import * as Menubar from '$lib/components/shadcn/menubar/menubar.svelte';
	import * as Select from '$lib/components/shadcn/select/index.js';
	import * as Sheet from '$lib/components/shadcn/sheet/index.js';

	import * as Maps from '$lib/components/custom/google-maps/index.js';
	import { browser } from '$app/environment';

	let { data }: { data: PageData } = $props();

	const { neighbourhoods, regions } = data;

	function filterNeighbourhoods(id: number) {
		return neighbourhoods.filter((neighbourhood) => neighbourhood.region_id === id);
	}

	const markerOpts = {
		position: { lat: 43.730091, lng: -79.399199 }
	};

	let markerVisiblity = $state(false);
	let polygonVisiblity = $state(false);

	function toggleMarker() {
		markerVisiblity = !markerVisiblity;
	}

	function togglePolygon() {
		polygonVisiblity = !polygonVisiblity;
	}
</script>

<div class="w-100[dvw] h-[100dvh] overflow-hidden">
	<button onclick={toggleMarker}>Toggle Marker Visiblity {markerVisiblity}</button>
	<button onclick={togglePolygon}>Toggle Polygon Visiblity {polygonVisiblity}</button>
	<Maps.ApiProvider
		apiKey={PUBLIC_GOOGLE_MAPS_API_KEY}
		libraries={['maps', 'marker']}
		onError={(error) => {
			console.error('Custom error', error);
		}}
	>
		<Maps.Map class="h-full w-full">
			<!--<Maps.MarkerLayer visible={markerVisiblity}>
				<Maps.Marker position={markerOpts.position}></Maps.Marker>
			</Maps.MarkerLayer>
			{#each regions as region}
				<Maps.PolygonLayer
					visible={polygonVisiblity}
					name={region.name}
					defaultStyling={{
						fillColor: region.color,
						fillOpacity: 0.3,
						strokeColor: region.color,
						strokeWeight: 1,
						strokeOpacity: 1
					}}
				>
					{#each filterNeighbourhoods(region.id) as neighbourhood}
						<Maps.Polygon geometry={[neighbourhood.polygon_data]}></Maps.Polygon>
					{/each}
				</Maps.PolygonLayer>
			{/each}-->
		</Maps.Map>
	</Maps.ApiProvider>
</div>
