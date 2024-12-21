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
	import { z } from 'zod';

	let { data }: { data: PageData } = $props();

	const { neighbourhoods, regions } = data;

	console.log(neighbourhoods.slice(0, 5));

	function filterNeighbourhoods(id: number) {
		return neighbourhoods.filter((neighbourhood) => neighbourhood.region_id === id);
	}

	const markerOpts = {
		position: { lat: 43.730091, lng: -79.399199 }
	};

	const polygonSchema = z.object({
		region_id: z.number(),
		name_pretty: z.string(),
		name_code: z.string()
	});

	let markerVisiblity = $state(false);
	let polygonVisiblity = $state(true);

	function toggleMarker() {
		markerVisiblity = !markerVisiblity;
	}

	let applyFilter = $state(false);

	function togglePolygon() {
		polygonVisiblity = !polygonVisiblity;
	}

	function toggleFilter() {
		applyFilter = !applyFilter;
	}
</script>

<div class="w-100[dvw] h-[100dvh] overflow-hidden">
	<button onclick={toggleMarker}>Toggle Marker Visiblity {markerVisiblity}</button>
	<button onclick={togglePolygon}>Toggle Polygon Visiblity {polygonVisiblity}</button>
	<button onclick={toggleFilter}>Toggle Polygon Filter {applyFilter}</button>
	<Maps.ApiProvider apiKey={PUBLIC_GOOGLE_MAPS_API_KEY} libraries={['maps', 'marker']}>
		<Maps.Map class="h-full w-full">
			<Maps.MarkerLayer visible={markerVisiblity}>
				<Maps.Marker position={markerOpts.position}></Maps.Marker>
			</Maps.MarkerLayer>
			{#each regions as region}
				<Maps.PolygonLayer
					visible={polygonVisiblity}
					name={region.name}
					attributeSchema={polygonSchema}
					filter={applyFilter
						? (polygon) => {
								return polygon.attributes.name_pretty.includes('Toronto');
							}
						: undefined}
					defaultStyling={{
						fillColor: region.color,
						fillOpacity: 0.3,
						strokeColor: region.color,
						strokeWeight: 1,
						strokeOpacity: 1
					}}
				>
					{#snippet children({ attributeSchema })}
						{#each filterNeighbourhoods(region.id) as neighbourhood}
							<Maps.Polygon geometry={[neighbourhood.polygon_data]} {attributeSchema}
							></Maps.Polygon>
						{/each}
					{/snippet}
					<!---->
				</Maps.PolygonLayer>
			{/each}
		</Maps.Map>
	</Maps.ApiProvider>
</div>
