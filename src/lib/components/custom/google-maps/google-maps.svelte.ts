import { createContext } from '$lib/internal/create-context.js';
import { Loader, type LoaderOptions } from '@googlemaps/js-api-loader';
import { FiniteStateMachine } from 'runed';
import { SvelteMap } from 'svelte/reactivity';
import type { Expand } from 'svelte-toolbelt';
import { useId } from '$lib/internal/use-id';

type VisibilityStates = 'hidden' | 'visible';
type VisibilityEvents = 'hide' | 'show';
type VisibilityStateMachineFunctions = {
	show: () => void;
	hide: () => void;
};
type VisibilityStateMachine = FiniteStateMachine<VisibilityStates, VisibilityEvents>;

function visibilityStateMachine(initiallyVisible: boolean, fn: VisibilityStateMachineFunctions) {
	const initialState = initiallyVisible ? 'visible' : 'hidden';
	return new FiniteStateMachine<VisibilityStates, VisibilityEvents>(initialState, {
		hidden: {
			show: 'visible',
			_enter: () => {
				fn.hide();
			}
		},
		visible: {
			hide: 'hidden',
			_enter: () => {
				fn.show();
			}
		}
	});
}

type FeatureBaseProps = {
	id: string;
	visible: boolean;
};

abstract class FeatureBase<
	TFeature extends FeatureBase<TFeature, TLayer>,
	TLayer extends LayerBase<TFeature, TLayer>
> implements MapFeature
{
	#id: string;
	#map: GoogleMap;
	#layer: TLayer;
	#visibility?: VisibilityStateMachine;

	constructor(props: FeatureBaseProps, map: GoogleMap, layer: TLayer) {
		this.#id = props.id;
		this.#map = map;
		this.#layer = layer;

		this.#layer.addFeature(this as unknown as TFeature);
	}

	protected initializeVisibility(initialVisibility: boolean) {
		if (this.#visibility) return; // Prevent re-initialization
		this.#visibility = visibilityStateMachine(initialVisibility, {
			show: () => this.onShow(),
			hide: () => this.onHide()
		});
	}

	abstract onShow(): void;
	abstract onHide(): void;

	hide() {
		if (!this.#visibility) return;
		this.#visibility.send('hide');
	}

	show() {
		if (!this.#visibility) return;
		this.#visibility.send('show');
	}

	isVisible() {
		if (!this.#visibility) return false;
		return this.#visibility.current === 'visible';
	}

	delete() {
		this.#layer.deleteFeature(this.id);
	}

	get map() {
		return this.#map;
	}

	get layer() {
		return this.#layer;
	}

	get id() {
		return this.#id;
	}
}

type LayerBaseProps = FeatureBaseProps & {
	name: string;
};

abstract class LayerBase<
	TFeature extends FeatureBase<TFeature, TLayer>,
	TLayer extends LayerBase<TFeature, TLayer>
> implements MapFeature
{
	#id: string;
	name: string;
	#map: GoogleMap;
	#visibility?: VisibilityStateMachine;
	#features = new SvelteMap<string, TFeature>();

	constructor(props: LayerBaseProps, map: GoogleMap) {
		this.#id = props.id;
		this.#map = map;
		this.name = props.name;
	}

	protected initializeVisibility(initialVisibility: boolean) {
		if (this.#visibility) return; // Prevent re-initialization
		this.#visibility = visibilityStateMachine(initialVisibility, {
			show: () => this.onShow(),
			hide: () => this.onHide()
		});
	}

	abstract onShow(): void;
	abstract onHide(): void;
	abstract deleteFeature(id: string): void;
	abstract delete(): void;

	addFeature(feature: TFeature) {
		this.#features.set(feature.id, feature);
	}

	clearFeatures() {
		this.#features.forEach((feature) => {
			this.deleteFeature(feature.id);
		});
	}

	hide() {
		if (!this.#visibility) return;
		this.#visibility.send('hide');
	}

	show() {
		if (!this.#visibility) return;
		this.#visibility.send('show');
	}

	isVisible() {
		if (!this.#visibility) return false;
		return this.#visibility.current === 'visible';
	}

	get id() {
		return this.#id;
	}

	get map() {
		return this.#map;
	}

	get features() {
		return this.#features;
	}
}

type MapFeature = {
	hide: () => void;
	show: () => void;
	isVisible: () => boolean;
	delete: () => void;
};

type BaseProps = {
	id: string;
	visible: boolean;
};

type MarkerProps = Expand<BaseProps & Omit<google.maps.marker.AdvancedMarkerElementOptions, 'map'>>;

class Marker extends FeatureBase<Marker, MarkerLayer> {
	#marker: google.maps.marker.AdvancedMarkerElement;

	constructor(props: MarkerProps, map: GoogleMap, layer: MarkerLayer) {
		const { id, visible, ...opts } = props;
		super(
			{
				id,
				visible
			},
			map,
			layer
		);

		this.#marker = new google.maps.marker.AdvancedMarkerElement({
			...opts,
			map: this.map.googleMap
		});

		this.initializeVisibility(visible);
		this.layer.addFeature(this);
	}

	onShow() {
		this.#marker.map = this.map.googleMap;
	}

	onHide() {
		this.#marker.map = null;
	}

	get googleMarker() {
		return this.#marker;
	}
}

type PolygonProps<T extends Record<string, unknown> | null = null> = Expand<
	BaseProps & {
		geometry: google.maps.Data.Polygon;
		properties: T;
	}
>;

class Polygon extends FeatureBase<Polygon, PolygonLayer> {
	#polygon: google.maps.Data.Feature;

	constructor(props: PolygonProps, map: GoogleMap, layer: PolygonLayer) {
		super(
			{
				id: props.id,
				visible: props.visible
			},
			map,
			layer
		);

		this.#polygon = new google.maps.Data.Feature({
			id: props.id,
			geometry: props.geometry,
			properties: props.properties
		});
		this.initializeVisibility(props.visible);
		this.layer.addFeature(this);
		this.layer.googleLayer.add(this.#polygon);
	}

	onShow() {
		this.layer.googleLayer.overrideStyle(this.#polygon, { visible: true });
	}

	onHide() {
		this.layer.googleLayer.overrideStyle(this.#polygon, { visible: false });
	}

	get googlePolygon() {
		return this.#polygon;
	}
}

type LayerProps = Expand<
	BaseProps & {
		name: string;
	}
>;

type MarkerLayerProps = Expand<LayerProps>;

class MarkerLayer extends LayerBase<Marker, MarkerLayer> {
	constructor(props: MarkerLayerProps, map: GoogleMap) {
		super(
			{
				id: props.id,
				visible: props.visible,
				name: props.name
			},
			map
		);

		this.initializeVisibility(props.visible);
		this.map.addDataLayer(this);
	}

	onShow() {
		this.features.forEach((feature) => {
			feature.show();
		});
	}

	onHide() {
		this.features.forEach((feature) => {
			feature.hide();
		});
	}

	deleteFeature(id: string) {
		const feature = this.features.get(id);
		if (!feature) return;
		feature.hide();
		this.features.delete(id);
	}

	delete() {
		this.clearFeatures();
	}

	get markers() {
		return this.features;
	}
}

type PolygonLayerProps = Expand<LayerProps & Omit<google.maps.Data.DataOptions, 'map'>>;

class PolygonLayer extends LayerBase<Polygon, PolygonLayer> {
	#googleLayer: google.maps.Data;

	constructor(props: PolygonLayerProps, map: GoogleMap) {
		const { id, name, visible, ...opts } = props;
		super(
			{
				id,
				visible,
				name
			},
			map
		);

		this.#googleLayer = new google.maps.Data({ map: this.map.googleMap, ...opts });

		this.initializeVisibility(visible);
		this.map.addDataLayer(this);
	}

	onShow() {
		this.#googleLayer.setMap(this.map.googleMap);
	}

	onHide() {
		this.#googleLayer.setMap(null);
	}

	deleteFeature(id: string) {
		const feature = this.features.get(id);
		if (!feature) return;
		this.#googleLayer.remove(feature.googlePolygon);
		this.features.delete(id);
	}

	delete() {
		this.clearFeatures();
		this.hide();
	}

	get polygons() {
		return this.features;
	}

	get googleLayer() {
		return this.#googleLayer;
	}
}

type GoogleMapsApiLoaderProps = {
	libraries: NonNullable<LoaderOptions['libraries']>;
	version: NonNullable<LoaderOptions['version']>;
	apiKey: LoaderOptions['apiKey'];
	region: NonNullable<LoaderOptions['region']>;
};

type GoogleMapsApiLoaderStates = 'inert' | 'loading' | 'loaded' | 'error';
type GoogleMapsApiLoaderEvents = 'startLoading' | 'toggleLoaded' | 'toggleError';
const apiLoaderState = new FiniteStateMachine<GoogleMapsApiLoaderStates, GoogleMapsApiLoaderEvents>(
	'inert',
	{
		inert: {
			startLoading: 'loading'
		},
		loading: {
			toggleLoaded: 'loaded',
			toggleError: 'error'
		},
		loaded: {},
		error: {}
	}
);

export class GoogleMapsApiLoader {
	#loader: Loader;
	status = apiLoaderState;

	constructor(props: GoogleMapsApiLoaderProps) {
		this.#loader = new Loader({
			apiKey: props.apiKey,
			version: props.version,
			libraries: props.libraries,
			region: props.region
		});

		$effect(() => {
			this.loadLibraries();
		});
	}

	async loadLibraries() {
		if (typeof window === 'undefined') {
			// If running on the server, do not attempt to load the libraries
			return false;
		}
		try {
			this.status.send('startLoading');
			const results = this.#loader.libraries.map((library) => this.#loader.importLibrary(library));

			await Promise.all(results);

			this.status.send('toggleLoaded');
		} catch (error) {
			console.error('Error loading Google Maps libraries:', error);
			this.status.send('toggleError');
		}
	}

	get loadedLibraries() {
		if (this.status.current !== 'loaded') return;

		return this.#loader.libraries;
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

type DataLayer = PolygonLayer | MarkerLayer;

export class GoogleMap {
	root: GoogleMapsApiLoader;
	#map: google.maps.Map;
	#state = googleMapState;
	#dataLayers = new SvelteMap<string, DataLayer>();

	constructor(props: GoogleMapProps, root: GoogleMapsApiLoader) {
		this.root = root;
		if (!this.root.loadedLibraries || !this.root.loadedLibraries.includes('maps')) {
			throw new Error('Please import the Google Maps "maps" library to use the Map component.');
		}
		this.#map = new google.maps.Map(props.mapDiv, { mapId: props.mapId, ...props.opts });
	}

	get googleMap() {
		return this.#map;
	}

	get googleMapState() {
		return this.#state;
	}

	get dataLayers() {
		return this.#dataLayers;
	}

	addDataLayer(data: DataLayer) {
		this.#dataLayers.set(data.id, data);
	}

	deleteDataLayer(id: string) {
		const layer = this.#dataLayers.get(id);
		if (!layer) return;
		layer.delete();
		this.#dataLayers.delete(id);
	}

	hideDataLayer(id: string) {
		this.#dataLayers.get(id)?.hide();
	}

	showDataLayer(id: string) {
		this.#dataLayers.get(id)?.show();
	}

	clearDataLayers() {
		for (const id of this.#dataLayers.keys()) {
			this.deleteDataLayer(id);
		}
	}

	smoothZoom = async (targetZoomLevel: number, location?: LatLng) => {
		const initialZoomLevel = this.#map.getZoom();
		if (initialZoomLevel === undefined) return;

		if (location) {
			await this.#panAndZoom(targetZoomLevel, initialZoomLevel, location);
		} else {
			await this.#zoomTo(targetZoomLevel);
		}
		if (this.#state.current === 'zooming') this.#state.send('toggleZooming');
	};

	#checkPointInBounds = (point: LatLng) => {
		const bounds = this.#map.getBounds();
		if (!bounds) return false;
		return bounds.contains(point);
	};

	#panAndZoom = async (targetZoomLevel: number, initialZoomLevel: number, location: LatLng) => {
		// If the new location is outside the map bounds, continue to zoom out

		while (!this.#checkPointInBounds(location)) {
			const currentZoomLevel = this.#map.getZoom();
			if (currentZoomLevel === undefined) return;

			await this.#zoomTo(currentZoomLevel - 1);
		}

		this.#state.send('togglePanning');

		this.#map.panTo(location);

		await new Promise<void>((resolve) => {
			google.maps.event.addListenerOnce(this.#map, 'idle', async () => {
				await this.#zoomTo(targetZoomLevel);
				resolve();
			});
		});
	};

	#zoomTo = async (targetZoomLevel: number, nextZoomLevel?: number): Promise<void> => {
		const currentZoom = this.#map.getZoom();

		if (currentZoom === undefined || currentZoom === targetZoomLevel) {
			return;
		}

		nextZoomLevel = targetZoomLevel > currentZoom ? currentZoom + 1 : currentZoom - 1;

		return new Promise((resolve) => {
			const zoomChangeListener = google.maps.event.addListener(
				this.#map,
				'zoom_changed',
				async () => {
					google.maps.event.removeListener(zoomChangeListener);
					await this.#zoomTo(targetZoomLevel, nextZoomLevel);
					resolve();
				}
			);

			this.#doZoom(nextZoomLevel);
		});
	};

	#doZoom = (zoomLevel: number) => {
		if (this.#state.current !== 'zooming') this.#state.send('toggleZooming');
		setTimeout(() => {
			this.#map.setZoom(zoomLevel);
		}, 30);
	};
}

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

const [setRootContext, getRootContext] = createContext<GoogleMapsApiLoader>('Maps.ApiProvider');

const [setMapContext, getMapContext] = createContext<GoogleMap>('Maps.Map');

const [setMarkerLayerContext, getMarkerLayerContext] =
	createContext<MarkerLayer>('Maps.MarkerLayer');

const [setPolygonLayerContext, getPolygonLayerContext] =
	createContext<PolygonLayer>('Maps.PolygonLayer');

const [setMarkerContext, getMarkerContext] = createContext<Marker>('Maps.Marker');

const [setPolygonContext, getPolygonContext] = createContext<Polygon>('Maps.Polygon');

export function useGoogleMapsRoot(props: GoogleMapsApiLoaderProps) {
	return setRootContext(new GoogleMapsApiLoader(props));
}

export function useGoogleMapsMap(props: GoogleMapProps) {
	const root = getRootContext();
	return setMapContext(new GoogleMap(props, root));
}

export function useGoogleMapsMarkerLayer(props: MarkerLayerProps) {
	const map = getMapContext();
	return setMarkerLayerContext(new MarkerLayer(props, map));
}

export function useGoogleMapsPolygonLayer(props: PolygonLayerProps) {
	const map = getMapContext();
	return setPolygonLayerContext(new PolygonLayer(props, map));
}

export function useGoogleMapsMarker(props: MarkerProps) {
	const map = getMapContext();
	const markerLayer = getMarkerLayerContext();
	return setMarkerContext(new Marker(props, map, markerLayer));
}

export function useGoogleMapsPolygon(props: PolygonProps) {
	const map = getMapContext();
	const polygonLayer = getPolygonLayerContext();

	return setPolygonContext(new Polygon(props, map, polygonLayer));
}
