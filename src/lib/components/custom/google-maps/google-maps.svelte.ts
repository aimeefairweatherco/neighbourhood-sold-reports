import { createContext } from '$lib/internal/create-context.js';
import { getContext, setContext } from 'svelte';
import { FiniteStateMachine } from 'runed';
import { SvelteMap } from 'svelte/reactivity';
import { GoogleMapsApiLoader, type GoogleMapsApiLoaderProps } from './api-loader.svelte.js';
import type { Expand } from 'svelte-toolbelt';
import type { ZodObject, ZodType, infer as zInfer } from 'zod';
import { ZodError } from 'zod';
import { useId } from '$lib/internal/use-id.js';

export type ApiProviderStateProps = Expand<
	GoogleMapsApiLoaderProps & {
		onError?: (error: Error) => void;
	}
>;

export class ApiProviderState {
	#loader: GoogleMapsApiLoader;
	#requestedLibraries = $state<ApiProviderStateProps['libraries']>([]);
	#onError: ApiProviderStateProps['onError'];

	constructor(props: ApiProviderStateProps, loader: GoogleMapsApiLoader) {
		this.#loader = loader;
		this.#onError = props.onError;

		try {
			this.#loader.init(props);
			const requestedLibraries = new Set(props.libraries);
			this.#requestedLibraries.push(...requestedLibraries);

			this.#loader.loadLibraries(this.#requestedLibraries).catch((err) => {
				this.#handleError(err);
			});
		} catch (err) {
			this.#handleError(err);
		}
	}

	get apis() {
		return this.#loader.apis;
	}

	get loadedLibraries() {
		return this.#loader.loadedLibraries;
	}

	isFullyLoaded = $derived(
		this.#requestedLibraries.every((lib) => this.loadedLibraries.includes(lib))
	);

	#handleError(err: unknown) {
		const error = err instanceof Error ? err : new Error(String(err));
		if (this.#onError) {
			this.#onError(error);
			return;
		}

		throw err;
	}
}

type MapStates = 'idle' | 'zooming' | 'panning';
type MapEvents = 'toggleZooming' | 'togglePanning';
const mapFSM = new FiniteStateMachine<MapStates, MapEvents>('idle', {
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

type MapStateProps = {
	mapId: string;
	mapDiv: HTMLDivElement;
	opts?: Omit<google.maps.MapOptions, 'mapId'>;
};

type DataLayer<T extends ZodObject<any>> = PolygonLayerState<T> | MarkerLayerState<T>;

export class MapState {
	#apiProvider: ApiProviderState;
	#id: MapStateProps['mapId'];
	#mapDiv: MapStateProps['mapDiv'];
	#googleMap: google.maps.Map;
	#state = mapFSM;
	#dataLayers = new SvelteMap<string, DataLayer<any>>();

	constructor(props: MapStateProps, apiProvider: ApiProviderState) {
		this.#apiProvider = apiProvider;
		this.#id = props.mapId;
		this.#mapDiv = props.mapDiv;

		this.#googleMap = new google.maps.Map(this.#mapDiv, { mapId: this.#id, ...props.opts });
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

	addDataLayer(data: DataLayer<any>) {
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

export type MapFeatureTypes = 'polygon' | 'marker';

export type MapFeatureStateTypes<
	T extends MapFeatureTypes,
	S extends ZodObject<any>
> = T extends 'polygon'
	? PolygonFeatureState<S>
	: T extends 'marker'
		? MarkerFeatureState<S>
		: never;

type BaseLayerStateProps<T extends MapFeatureTypes, S extends ZodObject<any>> = {
	id: string;
	visible: boolean;
	name: string;
	attributeSchema: S;
};

abstract class BaseLayerState<T extends MapFeatureTypes, S extends ZodObject<any>> {
	abstract type: MapFeatureTypes;
	#apiProvider: ApiProviderState;
	#id: BaseLayerStateProps<T, S>['id'];
	name: BaseLayerStateProps<T, S>['name'];
	#visible = $state<BaseLayerStateProps<T, S>['visible']>(false);
	#filter = $state<((feature: MapFeatureStateTypes<T, S>) => boolean) | null>(null);
	#map: MapState;
	protected features = new SvelteMap<string, MapFeatureStateTypes<T, S>>();
	readonly attributeSchema: BaseLayerStateProps<T, S>['attributeSchema'];

	constructor(props: BaseLayerStateProps<T, S>, map: MapState) {
		this.#id = props.id;
		this.name = props.name;
		this.#map = map;
		this.#apiProvider = map.apiProvider;
		this.#visible = props.visible;
		this.attributeSchema = props.attributeSchema;
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
	protected abstract applyFilter(filter: (feature: MapFeatureStateTypes<T, S>) => boolean): void;

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

	setFilter(filterFn: ((feature: MapFeatureStateTypes<T, S>) => boolean) | null) {
		this.#filter = filterFn;
		if (this.visible && filterFn) {
			this.applyFilter(filterFn);
		} else if (this.visible) {
			// If filter is removed, show all
			this.showAll();
		}
	}

	addFeature(feature: MapFeatureStateTypes<T, S>) {
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

type MarkerLayerStateProps<T extends ZodObject<any>> = Expand<BaseLayerStateProps<'marker', T>>;

class MarkerLayerState<T extends ZodObject<any>> extends BaseLayerState<'marker', T> {
	readonly type: MapFeatureTypes = 'marker';
	constructor(props: MarkerLayerStateProps<T>, map: MapState) {
		super(props, map);

		this.map.addDataLayer(this);
	}

	protected hideAll() {
		this.features.forEach((marker) => (marker.googleMarker.map = null));
	}

	protected showAll() {
		this.features.forEach((marker) => (marker.googleMarker.map = this.map.googleMap));
	}

	protected applyFilter(filter: (marker: MarkerFeatureState<T>) => boolean) {
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

type PolygonLayerStateProps<S extends ZodObject<any>> = Expand<
	BaseLayerStateProps<'polygon', S> & {
		opts?: Omit<google.maps.Data.DataOptions, 'map'>;
		styling: {
			defaultStyling: PolygonStyling;
			hoverStyling: PolygonStyling;
			clickStyling: PolygonStyling;
		};
	}
>;

class PolygonLayerState<S extends ZodObject<any>> extends BaseLayerState<'polygon', S> {
	readonly type: MapFeatureTypes = 'polygon';
	#googleLayer: google.maps.Data;
	#styling: PolygonLayerStateProps<S>['styling'];

	constructor(props: PolygonLayerStateProps<S>, map: MapState) {
		const { opts, styling, ...superProps } = props;
		super(superProps, map);

		this.#styling = styling;
		this.#googleLayer = new google.maps.Data({ map: this.map.googleMap, ...opts });
		this.#googleLayer.setStyle(this.#dynamicStyle());
		this.#initEventListeners();

		this.map.addDataLayer(this);
	}

	protected hideAll() {
		this.#googleLayer.setMap(null);
	}

	protected showAll() {
		this.#googleLayer.setMap(this.map.googleMap);
		this.#googleLayer.revertStyle();
	}

	protected applyFilter(filter: (polygon: PolygonFeatureState<S>) => boolean) {
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
			const { feature } = event;
			layer.revertStyle(feature);
			layer.overrideStyle(feature, dynamicStyler('hover'));
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
	addFeature(polygon: PolygonFeatureState<S>) {
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

type LayerStateTypes<S extends ZodObject<any>> = MarkerLayerState<S> | PolygonLayerState<S>;

type BaseFeatureStateProps<T extends ZodObject<any>> = {
	id: string;
	attributeSchema: T;
	attributes: zInfer<T>;
};

abstract class BaseFeatureState<T extends ZodObject<any>, L extends LayerStateTypes<T>> {
	#id: BaseFeatureStateProps<T>['id'];
	#map: MapState;
	#layer: L;
	#apiProvider: ApiProviderState;
	#attributes = $state<BaseFeatureStateProps<T>['attributes']>({});

	constructor(props: BaseFeatureStateProps<T>, map: MapState, layer: L) {
		this.#id = props.id;
		this.#map = map;
		this.#layer = layer;
		this.#apiProvider = map.apiProvider;
		try {
			this.#attributes = props.attributeSchema.parse(props.attributes);
		} catch (e) {
			if (e instanceof ZodError) {
				const layerType = console.error(
					`An attribute schema was set for the ${this.#layer.type.toUpperCase()} layer '${this.#layer.name}' but the attributes didn't match the schema.`
				);
				throw e.errors;
			}
		}
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

	get attributes() {
		return this.#attributes;
	}
}

type MarkerFeatureStateProps<T extends ZodObject<any>> = Expand<
	BaseFeatureStateProps<T> & {
		markerOpts: Omit<google.maps.marker.AdvancedMarkerElementOptions, 'map'>;
	}
>;

export class MarkerFeatureState<T extends ZodObject<any>> extends BaseFeatureState<
	T,
	MarkerLayerState<T>
> {
	#marker: google.maps.marker.AdvancedMarkerElement;

	constructor(props: MarkerFeatureStateProps<T>, map: MapState, layer: MarkerLayerState<T>) {
		const { markerOpts, ...superProps } = props;

		super(superProps, map, layer);

		this.#marker = new google.maps.marker.AdvancedMarkerElement({
			...markerOpts,
			map: this.map.googleMap
		});

		this.layer.addFeature(this);
	}

	delete() {
		if (this.#marker) this.#marker.map = null;
	}

	get googleMarker() {
		return this.#marker;
	}
}

type PolygonFeatureStateProps<T extends ZodObject<any>> = Expand<
	BaseFeatureStateProps<T> & {
		opts: {
			geometry: google.maps.Data.Polygon;
		};
	}
>;
export class PolygonFeatureState<T extends ZodObject<any>> extends BaseFeatureState<
	T,
	PolygonLayerState<T>
> {
	#polygon: google.maps.Data.Feature;

	constructor(props: PolygonFeatureStateProps<T>, map: MapState, layer: PolygonLayerState<T>) {
		const { opts, ...superProps } = props;
		super(superProps, map, layer);

		this.#polygon = new google.maps.Data.Feature({
			id: this.id,
			geometry: opts.geometry
		});

		this.layer.addFeature(this);
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

const API_PROVIDER_CTX = Symbol.for('Maps.ApiProvider');
const MAP_CTX = Symbol.for('Maps.Map');
const MARKER_LAYER_CTX = Symbol.for('Maps.MarkerLayer');
const POLYGON_LAYER_CTX = Symbol.for('Maps.PolygonLayer');
const MARKER_CTX = Symbol.for('Maps.Marker');
const POLYGON_CTX = Symbol.for('Maps.Polygon');

// Need a global singleton for all providers. So we don't re-import existing libraries
const loader = new GoogleMapsApiLoader();

function contextError(thisComponent: Symbol, missingComponent: Symbol) {
	return new Error(
		`Missing context dependency: '${thisComponent.toString()}' must be used within a '${missingComponent.toString()}' component.`
	);
}

export function useApiProvider(props: ApiProviderStateProps) {
	return setContext(API_PROVIDER_CTX, new ApiProviderState(props, loader));
}

function getApiProvider() {
	return getContext<ApiProviderState>(API_PROVIDER_CTX);
}

export function useMap(props: MapStateProps) {
	const apiProvider = getApiProvider();
	if (!apiProvider) throw contextError(MAP_CTX, API_PROVIDER_CTX);
	return setContext(MAP_CTX, new MapState(props, apiProvider));
}

function getMapContext() {
	return getContext<MapState>(MAP_CTX);
}

export function useMarkerLayer<T extends ZodObject<any>>(props: MarkerLayerStateProps<T>) {
	const map = getMapContext();
	if (!map) throw contextError(MARKER_LAYER_CTX, MAP_CTX);
	return setContext<MarkerLayerState<T>>(MARKER_LAYER_CTX, new MarkerLayerState(props, map));
}

function getMarkerLayerContext<T extends ZodObject<any>>() {
	return getContext<MarkerLayerState<T>>(MARKER_LAYER_CTX);
}

export function usePolygonLayer<T extends ZodObject<any>>(props: PolygonLayerStateProps<T>) {
	const map = getMapContext();
	if (!map) throw contextError(POLYGON_LAYER_CTX, MAP_CTX);
	return setContext<PolygonLayerState<T>>(POLYGON_LAYER_CTX, new PolygonLayerState(props, map));
}

function getPolygonLayerContext<T extends ZodObject<any>>() {
	return getContext<PolygonLayerState<T>>(POLYGON_LAYER_CTX);
}

export function useMarker<T extends ZodObject<any>>(props: MarkerFeatureStateProps<T>) {
	const map = getMapContext();
	if (!map) throw contextError(MARKER_CTX, MAP_CTX);
	const markerLayer = getMarkerLayerContext<T>();
	if (!markerLayer) throw contextError(MARKER_CTX, MARKER_LAYER_CTX);
	return setContext<MarkerFeatureState<T>>(
		MARKER_CTX,
		new MarkerFeatureState(props, map, markerLayer)
	);
}

function getMarkerContext<T extends ZodObject<any>>() {
	return getContext<MarkerFeatureState<T>>(MARKER_CTX);
}

export function usePolygon<T extends ZodObject<any>>(props: PolygonFeatureStateProps<T>) {
	const map = getMapContext();
	if (!map) throw contextError(POLYGON_CTX, MAP_CTX);
	const polygonLayer = getPolygonLayerContext<T>();
	if (!polygonLayer) throw contextError(POLYGON_CTX, POLYGON_LAYER_CTX);
	return setContext<PolygonFeatureState<T>>(
		POLYGON_CTX,
		new PolygonFeatureState(props, map, polygonLayer)
	);
}

function getPolygonContext<T extends ZodObject<any>>() {
	return getContext<PolygonFeatureState<T>>(POLYGON_CTX);
}
