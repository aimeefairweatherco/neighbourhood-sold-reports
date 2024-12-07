import { createContext } from '$lib/internal/create-context.js';
import { Loader, type LoaderOptions } from '@googlemaps/js-api-loader';
import { FiniteStateMachine } from 'runed';
import { SvelteMap } from 'svelte/reactivity';
import type { Expand } from 'svelte-toolbelt';
import { useId } from '$lib/internal/use-id';
import type { L } from 'vitest/dist/chunks/reporters.D7Jzd9GS.js';
import type GoogleMaps from './components/google-maps.svelte';

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

export class GoogleMap {
	root: GoogleMapsApiLoader;
	map: google.maps.Map;
	state = googleMapState;
	dataLayers = new SvelteMap<string, GoogleMapsDataLayer>();

	constructor(props: GoogleMapProps, root: GoogleMapsApiLoader) {
		this.root = root;
		if (!this.root.loadedLibraries || !this.root.loadedLibraries.includes('maps')) {
			throw new Error('Please import the Google Maps "maps" library to use the Map component.');
		}
		this.map = new google.maps.Map(props.mapDiv, { mapId: props.mapId, ...props.opts });
	}

	addDataLayer(data: GoogleMapsDataLayer) {
		this.dataLayers.set(data.id, data);
	}

	deleteDataLayer(id: string) {
		this.dataLayers.delete(id);
	}

	hideDataLayer(id: string) {
		this.dataLayers.get(id)?.hide();
	}

	showDataLayer(id: string) {
		this.dataLayers.get(id)?.show();
	}

	clearDataLayers() {
		for (const id of this.dataLayers.values()) {
			id.delete();
		}
		this.dataLayers.clear();
	}

	smoothZoom = async (targetZoomLevel: number, location?: LatLng) => {
		const initialZoomLevel = this.map.getZoom();
		if (initialZoomLevel === undefined) return;

		if (location) {
			await this.#panAndZoom(targetZoomLevel, initialZoomLevel, location);
		} else {
			await this.#zoomTo(targetZoomLevel);
		}
		if (this.state.current === 'zooming') this.state.send('toggleZooming');
	};

	#checkPointInBounds = (point: LatLng) => {
		const bounds = this.map.getBounds();
		if (!bounds) return false;
		return bounds.contains(point);
	};

	#panAndZoom = async (targetZoomLevel: number, initialZoomLevel: number, location: LatLng) => {
		// If the new location is outside the map bounds, continue to zoom out

		while (!this.#checkPointInBounds(location)) {
			const currentZoomLevel = this.map.getZoom();
			if (currentZoomLevel === undefined) return;

			await this.#zoomTo(currentZoomLevel - 1);
		}

		this.state.send('togglePanning');

		this.map.panTo(location);

		await new Promise<void>((resolve) => {
			google.maps.event.addListenerOnce(this.map, 'idle', async () => {
				await this.#zoomTo(targetZoomLevel);
				resolve();
			});
		});
	};

	#zoomTo = async (targetZoomLevel: number, nextZoomLevel?: number): Promise<void> => {
		const currentZoom = this.map.getZoom();

		if (currentZoom === undefined || currentZoom === targetZoomLevel) {
			return;
		}

		nextZoomLevel = targetZoomLevel > currentZoom ? currentZoom + 1 : currentZoom - 1;

		return new Promise((resolve) => {
			const zoomChangeListener = google.maps.event.addListener(
				this.map,
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
		if (this.state.current !== 'zooming') this.state.send('toggleZooming');
		setTimeout(() => {
			this.map.setZoom(zoomLevel);
		}, 30);
	};
}

export type GoogleMapsVisibilityStates = 'hidden' | 'visible';
type GoogleMapsVisibilityEvents = 'hide' | 'show';
type GoogleMapsVisibilityStateMachineFunctions = {
	show: () => void;
	hide: () => void;
};

type VisibilityStateMachine = FiniteStateMachine<
	GoogleMapsVisibilityStates,
	GoogleMapsVisibilityEvents
>;
function visibilityStateMachine(
	initiallyVisible: boolean,
	fn: GoogleMapsVisibilityStateMachineFunctions
) {
	const initialState = initiallyVisible ? 'visible' : 'hidden';
	return new FiniteStateMachine<GoogleMapsVisibilityStates, GoogleMapsVisibilityEvents>(
		initialState,
		{
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
		}
	);
}

type GoogleMapsDataLayerProps = Expand<
	{
		id: string;
		visible: boolean;
	} & Omit<google.maps.Data.DataOptions, 'map'>
>;

type GoogleMapsDataLayerFeature = GoogleMapsMarkerFeature | GoogleMapsPolygonFeature;
class GoogleMapsDataLayer {
	#root: GoogleMapsApiLoader;
	map: GoogleMap;
	#id: GoogleMapsDataLayerProps['id'];
	#visibility: VisibilityStateMachine;
	features = new SvelteMap<string, GoogleMapsDataLayerFeature>();
	data: google.maps.Data;

	constructor(props: GoogleMapsDataLayerProps, map: GoogleMap) {
		const { id, visible, ...opts } = props;

		this.map = map;
		this.#root = map.root;
		this.#id = id;
		if (!this.#root.loadedLibraries || !this.#root.loadedLibraries.includes('maps')) {
			throw new Error(
				'Please import the Google Maps "maps" library to use the DataLayer component.'
			);
		}
		this.data = new google.maps.Data({ map: this.map.map, ...opts });

		this.#visibility = visibilityStateMachine(visible, {
			show: () => {
				this.data.setMap(this.map.map);
			},
			hide: () => {
				this.data.setMap(null);
			}
		});

		this.map.addDataLayer(this);
	}

	addFeature(feature: GoogleMapsDataLayerFeature) {
		this.features.set(feature.id, feature);
		this.data.add(feature.feature);
	}

	deleteFeature(id: string) {
		this.features.delete(id);
	}

	showFeature(id: string) {
		this.features.get(id)?.show();
	}

	hideFeature(id: string) {
		this.features.get(id)?.hide();
	}

	clearFeatures() {
		for (const id of this.features.values()) {
			id.delete();
		}
		this.features.clear();
	}

	get id() {
		return this.#id;
	}

	get parent() {
		return this.map;
	}

	hide() {
		this.#visibility.send('hide');
	}

	show() {
		this.#visibility.send('show');
	}

	delete() {
		this.data.setMap(null);
		this.map.deleteDataLayer(this.#id);
	}
}

type GoogleMapsSharedFeatureProps = Pick<GoogleMapsDataLayerProps, 'id' | 'visible'>;

export type GoogleMapsMarkerFeatureProps<T extends Record<string, unknown> | null = null> = Expand<
	GoogleMapsSharedFeatureProps & {
		geometry: LatLng;
		properties: T;
	}
>;

export type GoogleMapsPolygonFeatureProps<T extends Record<string, unknown> | null = null> = Expand<
	GoogleMapsSharedFeatureProps & {
		geometry: google.maps.Data.Polygon;
		properties: T;
	}
>;

type GoogleMapsFeatureProps = {
	Marker: GoogleMapsMarkerFeatureProps;
	Polygon: GoogleMapsPolygonFeatureProps;
};

class GoogleMapsFeature<T extends keyof GoogleMapsFeatureProps> {
	#root: GoogleMapsApiLoader;
	map: GoogleMap;
	#id: GoogleMapsFeatureProps[T]['id'];
	#visibility: VisibilityStateMachine;
	feature: google.maps.Data.Feature;
	dataLayer: GoogleMapsDataLayer;

	constructor(props: GoogleMapsFeatureProps[T], map: GoogleMap, dataLayer: GoogleMapsDataLayer) {
		const { id, visible, ...opts } = props;
		this.map = map;
		this.dataLayer = dataLayer;
		this.#root = map.root;
		this.#id = id;

		if (!this.#root.loadedLibraries || !this.#root.loadedLibraries.includes('maps')) {
			throw new Error('Please import the Google Maps "maps" library to use the Marker component.');
		}

		this.feature = new google.maps.Data.Feature({
			id: id,
			...opts
		});

		this.#visibility = visibilityStateMachine(visible, {
			show: () => {
				this.dataLayer.data.overrideStyle(this.feature, { visible: true });
			},
			hide: () => {
				this.dataLayer.data.overrideStyle(this.feature, { visible: false });
			}
		});

		this.dataLayer.addFeature(this);
	}

	get id() {
		return this.#id;
	}

	get parent() {
		return this.map;
	}

	hide() {
		this.#visibility.send('hide');
	}

	show() {
		this.#visibility.send('show');
	}

	delete() {
		this.dataLayer.data.remove(this.feature);
	}
}

class GoogleMapsMarkerFeature extends GoogleMapsFeature<'Marker'> {
	constructor(props: GoogleMapsMarkerFeatureProps, map: GoogleMap, dataLayer: GoogleMapsDataLayer) {
		super(props, map, dataLayer);
	}
}

class GoogleMapsPolygonFeature extends GoogleMapsFeature<'Polygon'> {
	constructor(
		props: GoogleMapsPolygonFeatureProps,
		map: GoogleMap,
		dataLayer: GoogleMapsDataLayer
	) {
		super(props, map, dataLayer);
	}
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

const [setGoogleMapsRootContext, getGoogleMapsRootContext] =
	createContext<GoogleMapsApiLoader>('Maps.ApiProvider');

const [setGoogleMapsMapContext, getGoogleMapsMapContext] = createContext<GoogleMap>('Maps.Map');

const [setGoogleMapsDataLayerContext, getGoogleMapsDataLayerContext] =
	createContext<GoogleMapsDataLayer>('Maps.Map', 'Maps.DataLayer');

const [setGoogleMapsMarkerContext, getGoogleMapsMarkerContext] =
	createContext<GoogleMapsMarkerFeature>(['Maps.Map', 'Maps.DataLayer'], 'Maps.Marker');

const [setGoogleMapsPolygonContext, getGoogleMapsPolygonContext] =
	createContext<GoogleMapsPolygonFeature>(['Maps.Map', 'Maps.DataLayer'], 'Maps.Polygon');

export function useGoogleMapsRoot(props: GoogleMapsApiLoaderProps) {
	return setGoogleMapsRootContext(new GoogleMapsApiLoader(props));
}

export function useGoogleMapsMap(props: GoogleMapProps) {
	const root = getGoogleMapsRootContext();
	return setGoogleMapsMapContext(new GoogleMap(props, root));
}

export function useGoogleMapsDataLayer(props: GoogleMapsDataLayerProps) {
	const map = getGoogleMapsMapContext();
	return setGoogleMapsDataLayerContext(new GoogleMapsDataLayer(props, map));
}

export function useGoogleMapsMarker(props: GoogleMapsFeatureProps['Marker']) {
	const map = getGoogleMapsMapContext();
	let dataLayer = getGoogleMapsDataLayerContext(null);

	if (!dataLayer) {
		dataLayer = new GoogleMapsDataLayer({ id: useId('dataLayer'), visible: props.visible }, map);
	}

	return setGoogleMapsMarkerContext(new GoogleMapsMarkerFeature(props, map, dataLayer));
}

export function useGoogleMapsPolygon(props: GoogleMapsFeatureProps['Polygon']) {
	const map = getGoogleMapsMapContext();
	let dataLayer = getGoogleMapsDataLayerContext(null);

	if (!dataLayer) {
		dataLayer = new GoogleMapsDataLayer({ id: useId('dataLayer'), visible: props.visible }, map);
	}
	return setGoogleMapsPolygonContext(new GoogleMapsPolygonFeature(props, map, dataLayer));
}
