import { createContext } from '$lib/internal/create-context.js';
import { FiniteStateMachine } from 'runed';
import { SvelteMap } from 'svelte/reactivity';
import { GoogleMapsApiLoader, type GoogleMapsApiLoaderProps } from './api-loader.svelte.js';
import type { Expand } from 'svelte-toolbelt';

export type GoogleMapsApiProviderProps = Expand<
	GoogleMapsApiLoaderProps & {
		onError?: (error: Error) => void;
	}
>;

export class GoogleMapsApiProvider {
	#loader: GoogleMapsApiLoader;
	#requestedLibraries = $state<GoogleMapsApiLoaderProps['libraries']>([]);

	private constructor(props: GoogleMapsApiProviderProps, loader: GoogleMapsApiLoader) {
		this.#loader = loader;
		const requestedLibraries = new Set(props.libraries);
		this.#requestedLibraries.push(...requestedLibraries);
	}

	static async create(props: GoogleMapsApiProviderProps, loader: GoogleMapsApiLoader) {
		loader.init(props);
		await loader.loadLibraries(props.libraries);
		return new GoogleMapsApiProvider(props, loader);
	}

	get apis() {
		return this.#loader.apis;
	}

	get loadedLibraries() {
		return this.#loader.loadedLibraries;
	}
}

type GoogleMapStates = 'idle' | 'zooming' | 'panning';
type GoogleMapEvents = 'toggleZooming' | 'togglePanning';
const googleMapState = new FiniteStateMachine<GoogleMapStates, GoogleMapEvents>('idle', {
	idle: {
		toggleZooming: 'zooming',
		togglePanning: 'panning'
	},
	zooming: {
		toggleZooming: 'idle',
		togglePanning: 'panning'
	},
	panning: {
		togglePanning: 'idle',
		toggleZooming: 'zooming'
	}
});

type LatLng = google.maps.LatLng | google.maps.LatLngLiteral;

type GoogleMapProps = {
	mapId: string;
	mapDiv: HTMLDivElement;
	opts?: Omit<google.maps.MapOptions, 'mapId'>;
};

type DataLayer = MapPolygonLayer | MapMarkerLayer;

export class GoogleMap {
	#apiProvider: GoogleMapsApiProvider;
	#id: GoogleMapProps['mapId'];
	#mapDiv: GoogleMapProps['mapDiv'];
	#googleMap: google.maps.Map;
	#state = googleMapState;
	#dataLayers = new SvelteMap<string, DataLayer>();

	private constructor(
		props: GoogleMapProps,
		apiProvider: GoogleMapsApiProvider,
		googleMapInstance: google.maps.Map
	) {
		this.#apiProvider = apiProvider;
		this.#id = props.mapId;
		this.#mapDiv = props.mapDiv;
		this.#googleMap = googleMapInstance;
	}

	/**
	 * Static factory method to create a fully-initialized GoogleMap instance.
	 * Assumes `apiProvider` is already resolved and `google.maps` is ready.
	 */
	static async create(
		props: GoogleMapProps,
		apiProvider: Promise<GoogleMapsApiProvider>
	): Promise<GoogleMap> {
		const _apiProvider = await apiProvider;
		const googleMapInstance = new google.maps.Map(props.mapDiv, {
			mapId: props.mapId,
			...props.opts
		});
		return new GoogleMap(props, _apiProvider, googleMapInstance);
	}

	get id() {
		return this.#id;
	}

	get mapDiv() {
		return this.#mapDiv;
	}

	get googleMap() {
		return this.#googleMap;
	}

	get googleMapState() {
		return this.#state;
	}

	get dataLayers() {
		return this.#dataLayers;
	}

	get apiProvider() {
		return this.#apiProvider;
	}

	addDataLayer(data: DataLayer) {
		this.#dataLayers.set(data.id, data);
	}

	deleteDataLayer(id: string) {
		const layer = this.#dataLayers.get(id);
		if (!layer) return;
		this.#dataLayers.delete(id);
		layer.delete();
	}

	hideDataLayer(id: string) {
		const layer = this.#dataLayers.get(id);
		if (!layer) return;
		layer.visible = false;
	}

	showDataLayer(id: string) {
		const layer = this.#dataLayers.get(id);
		if (!layer) return;
		layer.visible = true;
	}

	clearDataLayers() {
		for (const id of this.#dataLayers.keys()) {
			this.deleteDataLayer(id);
		}
	}

	smoothZoom = async (targetZoomLevel: number, location?: LatLng) => {
		const initialZoomLevel = this.#googleMap.getZoom();
		if (initialZoomLevel === undefined) return;

		if (location) {
			await this.#panAndZoom(targetZoomLevel, initialZoomLevel, location);
		} else {
			await this.#zoomTo(targetZoomLevel);
		}
		if (this.#state.current === 'zooming') this.#state.send('toggleZooming');
	};

	#checkPointInBounds = (point: LatLng) => {
		const bounds = this.#googleMap.getBounds();
		if (!bounds) return false;
		return bounds.contains(point);
	};

	#panAndZoom = async (targetZoomLevel: number, initialZoomLevel: number, location: LatLng) => {
		while (!this.#checkPointInBounds(location)) {
			const currentZoomLevel = this.#googleMap.getZoom();
			if (currentZoomLevel === undefined) return;
			await this.#zoomTo(currentZoomLevel - 1);
		}

		this.#state.send('togglePanning');
		this.#googleMap.panTo(location);

		await new Promise<void>((resolve) => {
			google.maps.event.addListenerOnce(this.#googleMap, 'idle', async () => {
				await this.#zoomTo(targetZoomLevel);
				resolve();
			});
		});
	};

	#zoomTo = async (targetZoomLevel: number, nextZoomLevel?: number): Promise<void> => {
		const currentZoom = this.#googleMap.getZoom();
		if (currentZoom === undefined || currentZoom === targetZoomLevel) {
			return;
		}

		const nextZoomWithDirection = targetZoomLevel > currentZoom ? currentZoom + 1 : currentZoom - 1;

		return new Promise<void>((resolve) => {
			const zoomChangeListener = google.maps.event.addListener(
				this.#googleMap,
				'zoom_changed',
				async () => {
					google.maps.event.removeListener(zoomChangeListener);
					await this.#zoomTo(targetZoomLevel, nextZoomLevel);
					resolve();
				}
			);

			this.#doZoom(nextZoomWithDirection);
		});
	};

	#doZoom = (zoomLevel: number) => {
		if (this.#state.current !== 'zooming') {
			this.#state.send('toggleZooming');
		}
		setTimeout(() => {
			this.#googleMap.setZoom(zoomLevel);
		}, 30);
	};
}

type MapFeatureProps = {
	id: string;
};

export type MapFeatureTypes = MapMarker | MapPolygon;

type MapLayerProps = Expand<
	MapFeatureProps & {
		visible: boolean;
		name: string;
	}
>;

abstract class MapLayer<T extends MapFeatureTypes> {
	#apiProvider: GoogleMapsApiProvider;
	#id: MapLayerProps['id'];
	name: MapLayerProps['name'];
	#visible = $state<MapLayerProps['visible']>(false);
	#filter = $state<((feature: T) => boolean) | null>(null);
	#map: GoogleMap;
	protected features = new SvelteMap<string, T>();

	constructor(props: MapLayerProps, map: GoogleMap) {
		this.#id = props.id;
		this.name = props.name;
		this.#map = map;
		this.#apiProvider = map.apiProvider;
		this.#visible = props.visible;
	}

	get id() {
		return this.#id;
	}

	get map() {
		return this.#map;
	}

	get apiProvider() {
		return this.#apiProvider;
	}

	protected abstract hideAll(): void;
	protected abstract showAll(): void;
	protected abstract applyFilter(filter: (feature: T) => boolean): void;

	set visible(value: boolean) {
		this.#visible = value;
		if (value) {
			this.showAll();
			// Reapply filter if exists
			if (this.#filter) {
				this.applyFilter(this.#filter);
			}
		} else {
			this.hideAll();
		}
	}

	get visible() {
		return this.#visible;
	}

	setFilter(filterFn: ((feature: T) => boolean) | null) {
		this.#filter = filterFn;
		if (this.visible && filterFn) {
			this.applyFilter(filterFn);
		} else if (this.visible) {
			// If filter is removed, show all
			this.showAll();
		}
	}

	addFeature(feature: T) {
		this.features.set(feature.id, feature);
		if (this.#visible) {
			this.showAll();
		} else {
			this.hideAll();
		}
	}

	deleteFeature(id: string) {
		const feature = this.features.get(id);
		if (!feature) return;
		this.features.delete(id);
		feature.delete();
	}

	clearFeatures() {
		this.features.forEach((feature) => {
			this.deleteFeature(feature.id);
		});
	}
}

class MapMarkerLayer extends MapLayer<MapMarker> {
	private constructor(props: MapLayerProps, map: GoogleMap) {
		super(props, map);
		this.map.addDataLayer(this);
	}

	static async create(props: MapLayerProps, map: Promise<GoogleMap>): Promise<MapMarkerLayer> {
		const _map = await map;
		return new MapMarkerLayer(props, _map);
	}

	protected hideAll() {
		this.features.forEach((marker) => (marker.googleMarker.map = null));
	}

	protected showAll() {
		this.features.forEach((marker) => (marker.googleMarker.map = this.map.googleMap));
	}

	protected applyFilter(filter: (marker: MapMarker) => boolean) {
		this.features.forEach((marker) => {
			marker.googleMarker.map = filter(marker) ? this.map.googleMap : null;
		});
	}

	delete() {
		this.clearFeatures();
		this.map.deleteDataLayer(this.id);
	}

	get markers() {
		return this.features;
	}
}

export const polygonDefaultStyles: Record<string, PolygonStyling> = {
	default: {
		fillColor: '#FF0000',
		fillOpacity: 0.5,
		strokeColor: '#FF0000',
		strokeWeight: 2,
		strokeOpacity: 1
	},
	hover: {
		strokeWeight: 4,
		zIndex: 10
	},
	click: {
		fillColor: '#07EDE5',
		fillOpacity: 0.5,
		strokeColor: '#07EDE5',
		strokeWeight: 4,
		strokeOpacity: 1,
		zIndex: 10
	}
};

export type PolygonStyling = Partial<
	Pick<
		google.maps.Data.StyleOptions,
		| 'fillColor'
		| 'fillOpacity'
		| 'strokeColor'
		| 'strokeWeight'
		| 'strokeOpacity'
		| 'zIndex'
		| 'clickable'
	>
>;

type MapPolygonLayerProps = Expand<
	MapLayerProps & {
		opts?: Omit<google.maps.Data.DataOptions, 'map'>;
		styling: {
			defaultStyling: PolygonStyling;
			hoverStyling: PolygonStyling;
			clickStyling: PolygonStyling;
		};
	}
>;

class MapPolygonLayer extends MapLayer<MapPolygon> {
	#googleLayer: google.maps.Data;
	#styling: MapPolygonLayerProps['styling'];

	private constructor(props: MapPolygonLayerProps, map: GoogleMap) {
		const { opts, styling, ...superProps } = props;
		super(superProps, map);

		this.#styling = styling;
		this.#googleLayer = new google.maps.Data({ map: this.map.googleMap, ...opts });
		this.#googleLayer.setStyle(this.#dynamicStyle());
		this.#initEventListeners();

		this.map.addDataLayer(this);
	}

	static async create(
		props: MapPolygonLayerProps,
		map: Promise<GoogleMap>
	): Promise<MapPolygonLayer> {
		const _map = await map;
		return new MapPolygonLayer(props, _map);
	}

	protected hideAll() {
		this.#googleLayer.setMap(null);
	}

	protected showAll() {
		this.#googleLayer.setMap(this.map.googleMap);
	}

	protected applyFilter(filter: (polygon: MapPolygon) => boolean) {
		this.features.forEach((polygon) => {
			this.#googleLayer.overrideStyle(polygon.googlePolygon, {
				visible: filter(polygon)
			});
		});
	}

	delete() {
		this.#destroyEventListeners();
		this.clearFeatures();
		this.map.deleteDataLayer(this.id);
		this.#googleLayer.setMap(null);
	}

	#dynamicStyle(style: 'default' | 'hover' | 'click' = 'default') {
		switch (style) {
			case 'hover':
				return {
					...this.#styling.hoverStyling
				};
			case 'click':
				return {
					...this.#styling.clickStyling
				};
			default:
				return {
					...this.#styling.defaultStyling
				};
		}
	}

	#initEventListeners() {
		const layer = this.#googleLayer;

		const dynamicStyler = this.#dynamicStyle.bind(this);

		layer.addListener('click', function (event: google.maps.Data.MouseEvent) {
			layer.revertStyle();
			layer.overrideStyle(event.feature, dynamicStyler('click'));
		});

		layer.addListener('mouseover', function (event: google.maps.Data.MouseEvent) {
			layer.revertStyle();
			layer.overrideStyle(event.feature, dynamicStyler('hover'));
		});

		layer.addListener('mouseout', function () {
			layer.revertStyle();
		});
	}

	#destroyEventListeners() {
		const layer = this.#googleLayer;
		google.maps.event.clearInstanceListeners(layer);
	}

	// Need to override because the polygon needs to also be added to the google.map.Data class features
	addFeature(polygon: MapPolygon) {
		super.addFeature(polygon);
		this.#googleLayer.add(polygon.googlePolygon);
	}

	get polygons() {
		return this.features;
	}

	get googleLayer() {
		return this.#googleLayer;
	}
}

type MapLayerTypes = MapMarkerLayer | MapPolygonLayer;
abstract class MapFeature<T extends MapLayerTypes> {
	#id: MapFeatureProps['id'];
	#map: GoogleMap;
	#layer: T;
	#apiProvider: GoogleMapsApiProvider;

	constructor(props: MapFeatureProps, map: GoogleMap, layer: T) {
		this.#id = props.id;
		this.#map = map;
		this.#layer = layer;
		this.#apiProvider = map.apiProvider;
	}

	abstract delete(): void;

	get map() {
		return this.#map;
	}

	get layer() {
		return this.#layer;
	}

	get id() {
		return this.#id;
	}

	get apiProvider() {
		return this.#apiProvider;
	}
}

type MapMarkerProps = Expand<
	MapFeatureProps & { markerOpts: Omit<google.maps.marker.AdvancedMarkerElementOptions, 'map'> }
>;

export class MapMarker extends MapFeature<MapMarkerLayer> {
	#marker: google.maps.marker.AdvancedMarkerElement;

	private constructor(props: MapMarkerProps, map: GoogleMap, layer: MapMarkerLayer) {
		const { markerOpts, ...superProps } = props;
		super(superProps, map, layer);

		this.#marker = new google.maps.marker.AdvancedMarkerElement({
			...markerOpts,
			map: this.map.googleMap
		});

		this.layer.addFeature(this);
	}

	static async create(
		props: MapMarkerProps,
		map: Promise<GoogleMap>,
		layer: Promise<MapMarkerLayer>
	): Promise<MapMarker> {
		const [_map, _layer] = await Promise.all([map, layer]);
		return new MapMarker(props, _map, _layer);
	}

	delete() {
		if (this.#marker) this.#marker.map = null;
	}

	get googleMarker() {
		return this.#marker;
	}
}

type MapPolygonProps = Expand<
	MapFeatureProps & {
		opts: {
			geometry: google.maps.Data.Polygon;
		};
	}
>;
export class MapPolygon extends MapFeature<MapPolygonLayer> {
	#polygon: google.maps.Data.Feature;

	private constructor(props: MapPolygonProps, map: GoogleMap, layer: MapPolygonLayer) {
		const { opts, ...superProps } = props;
		super(superProps, map, layer);

		this.#polygon = new google.maps.Data.Feature({
			id: this.id,
			geometry: opts.geometry
		});

		this.layer.addFeature(this);
	}

	static async create(
		props: MapPolygonProps,
		map: Promise<GoogleMap>,
		layer: Promise<MapPolygonLayer>
	): Promise<MapPolygon> {
		const [_map, _layer] = await Promise.all([map, layer]);
		return new MapPolygon(props, _map, _layer);
	}

	delete() {
		this.layer.googleLayer.remove(this.#polygon);
	}

	get googlePolygon() {
		return this.#polygon;
	}
}

/*
export type Address = Expand<
	google.maps.LatLngLiteral & {
		number?: string;
		street: string;
		city: string;
		state: string;
		country: string;
		zip: string;
	}
>;

export type AddressAutocompleteProps = Expand<
	{
		input: HTMLInputElement;
	} & google.maps.places.AutocompleteOptions
>;

const defaultAutocompleteOptions: google.maps.places.AutocompleteOptions = {
	fields: ['formatted_address', 'address_components', 'geometry', 'place_id', 'type'],
	strictBounds: false,
	types: ['address'],
	componentRestrictions: { country: ['ca', 'us'] }
};

export class AddressAutocompleteState {
	#autocomplete: google.maps.places.Autocomplete;
	#input: HTMLInputElement;

	constructor(input: HTMLInputElement, options: google.maps.places.AutocompleteOptions) {
		this.#input = input;
		this.#autocomplete = new google.maps.places.Autocomplete(this.#input, options);
	}
}*/

/*

type GoogleMapsInfoWindowStateProps = {
    map: GoogleMapsMapState | null;
    anchor?: google.maps.InfoWindowOpenOptions['anchor'];
    options?: google.maps.InfoWindowOptions & {
        openOnFocus?: google.maps.InfoWindowOpenOptions['shouldFocus']; 
    };
}
export class GoogleMapsInfoWindowState {
    map: GoogleMapsInfoWindowStateProps['map'];
    anchor: GoogleMapsInfoWindowStateProps['anchor'];
    options: GoogleMapsInfoWindowStateProps['options'];

    constructor(props: GoogleMapsInfoWindowStateProps) {
        this.map = props.map;
        this.anchor = props.anchor;
        this.options = props.options;
    }
}

type GoogleMapsCustomControlStateProps = {
    map: GoogleMapsMapState | null;
    position: google.maps.ControlPosition;
    element: HTMLElement;
}
export class GoogleMapsCustomControlState {}

export class GoogleMapsAutoCompleteState {}
*/

const [setApiProviderContext, getApiProviderContext] =
	createContext<Promise<GoogleMapsApiProvider>>('Maps.ApiProvider');

const [setMapContext, getMapContext] = createContext<Promise<GoogleMap>>('Maps.Map');

const [setMarkerLayerContext, getMarkerLayerContext] =
	createContext<Promise<MapMarkerLayer>>('Maps.MarkerLayer');

const [setPolygonLayerContext, getPolygonLayerContext] =
	createContext<Promise<MapPolygonLayer>>('Maps.PolygonLayer');

const [setMarkerContext, getMarkerContext] = createContext<Promise<MapMarker>>('Maps.Marker');

const [setPolygonContext, getPolygonContext] = createContext<Promise<MapPolygon>>('Maps.Polygon');

// Need a global singleton for all providers. So we don't re-import existing libraries
const loader = new GoogleMapsApiLoader();

export function useGoogleMapsApiProvider(props: GoogleMapsApiProviderProps) {
	const apiProvider = GoogleMapsApiProvider.create(props, loader);
	return setApiProviderContext(apiProvider);
}

export function useGoogleMapsMap(props: GoogleMapProps) {
	const apiProvider = getApiProviderContext();
	const map = GoogleMap.create(props, apiProvider);
	return setMapContext(map);
}

export function useGoogleMapsMarkerLayer(props: MapLayerProps) {
	const map = getMapContext();
	const markerLayer = MapMarkerLayer.create(props, map);
	return setMarkerLayerContext(markerLayer);
}

export function useGoogleMapsPolygonLayer(props: MapPolygonLayerProps) {
	const map = getMapContext();
	const polygonLayer = MapPolygonLayer.create(props, map);
	return setPolygonLayerContext(polygonLayer);
}

export function useGoogleMapsMarker(props: MapMarkerProps) {
	const map = getMapContext();
	const markerLayer = getMarkerLayerContext();
	const marker = MapMarker.create(props, map, markerLayer);
	return setMarkerContext(marker);
}

export function useGoogleMapsPolygon(props: MapPolygonProps) {
	const map = getMapContext();
	const polygonLayer = getPolygonLayerContext();
	const polygon = MapPolygon.create(props, map, polygonLayer);

	return setPolygonContext(polygon);
}
