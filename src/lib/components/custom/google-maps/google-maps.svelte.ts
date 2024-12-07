import { createContext } from '$lib/internal/create-context.js';
import { Loader, type LoaderOptions } from '@googlemaps/js-api-loader';
import { FiniteStateMachine } from 'runed';
import { SvelteMap } from 'svelte/reactivity';

type GoogleMapsRootStateProps = {
	libraries: NonNullable<LoaderOptions['libraries']>;
	version: NonNullable<LoaderOptions['version']>;
	apiKey: LoaderOptions['apiKey'];
	region: NonNullable<LoaderOptions['region']>;
};

type ApiStates = 'inert' | 'loading' | 'loaded' | 'error';
type ApiEvents = 'startLoading' | 'toggleLoaded' | 'toggleError';
const apiState = new FiniteStateMachine<ApiStates, ApiEvents>('inert', {
	inert: {
		startLoading: 'loading'
	},
	loading: {
		toggleLoaded: 'loaded',
		toggleError: 'error'
	},
	loaded: {},
	error: {}
});

export class GoogleMapsRootState {
	#libraries: GoogleMapsRootStateProps['libraries'];
	#version: GoogleMapsRootStateProps['version'];
	#apiKey: NonNullable<GoogleMapsRootStateProps['apiKey']>;
	#region: GoogleMapsRootStateProps['region'];
	#loader: Loader;
	status = apiState;

	constructor(props: GoogleMapsRootStateProps) {
		this.#libraries = props.libraries;
		this.#version = props.version;
		this.#apiKey = props.apiKey;
		this.#region = props.region;
		this.#loader = new Loader({
			apiKey: this.#apiKey,
			version: this.#version,
			libraries: this.#libraries,
			region: this.#region
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
			const results = this.#libraries.map((library) => this.#loader.importLibrary(library));

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

type MapStates = 'idle' | 'zooming' | 'panning';
type MapEvents = 'mounted' | 'toggleZooming' | 'togglePanning';
const mapState = new FiniteStateMachine<MapStates, MapEvents>('idle', {
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

type GoogleMapsMapStateProps = {
	mapId: string;
	mapDiv: HTMLDivElement;
	opts?: Omit<google.maps.MapOptions, 'mapId'>;
};

export class GoogleMapsMapState {
	root: GoogleMapsRootState;
	map: google.maps.Map;
	state = mapState;
	#markers = new SvelteMap<string, GoogleMapsMarkerState>();
	#polygons = new SvelteMap<string, GoogleMapsPolygonState>();
	#dataLayers = new SvelteMap<string, GoogleMapsDataLayerState>();

	constructor(props: GoogleMapsMapStateProps, root: GoogleMapsRootState) {
		this.root = root;
		if (!this.root.loadedLibraries || !this.root.loadedLibraries.includes('maps')) {
			throw new Error('Please import the Google Maps "maps" library to use the Map component.');
		}
		this.map = new google.maps.Map(props.mapDiv, { mapId: props.mapId, ...props.opts });
	}

	addDataLayer(dataLayer: GoogleMapsDataLayerState) {
		this.#dataLayers.set(dataLayer.id, dataLayer);
	}

	addMarker(marker: GoogleMapsMarkerState) {
		this.#markers.set(marker.id, marker);
	}

	deleteMarker(id: string) {
		this.#markers.delete(id);
	}

	hideMarker(id: string) {
		this.#markers.get(id)?.hide();
	}

	showMarker(id: string) {
		this.#markers.get(id)?.show();
	}

	clearMarkers() {
		for (const marker of this.#markers.values()) {
			marker.delete();
		}
		this.#markers.clear();
	}

	get markers() {
		return this.#markers;
	}

	addPolygon(polygon: GoogleMapsPolygonState) {
		this.#polygons.set(polygon.id, polygon);
	}

	deletePolygon(id: string) {
		this.#polygons.delete(id);
	}

	hidePolygons(id: string) {
		this.#polygons.get(id)?.hide();
	}

	showPolygons(id: string) {
		this.#polygons.get(id)?.show();
	}

	clearPolygons() {
		for (const polygon of this.#polygons.values()) {
			polygon.delete();
		}
		this.#polygons.clear();
	}

	get polygons() {
		return this.#polygons;
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

type GoogleMapsDataLayerStateProps = google.maps.Data & {
	id: string;
};

class GoogleMapsDataLayerState {
	#root: GoogleMapsRootState;
	#mapState: GoogleMapsMapState;
	#id: GoogleMapsDataLayerStateProps['id'];
	data: google.maps.Data;

	constructor(props: GoogleMapsDataLayerStateProps, mapState: GoogleMapsMapState) {
		const { id, ...opts } = props;
		this.#mapState = mapState;
		this.#root = mapState.root;
		this.#id = id;
		if (!this.#root.loadedLibraries || !this.#root.loadedLibraries.includes('maps')) {
			throw new Error(
				'Please import the Google Maps "maps" library to use the DataLayer component.'
			);
		}

		this.data = new google.maps.Data(opts);
		this.#mapState.addDataLayer(this);
	}

	get id() {
		return this.#id;
	}

	get parent() {
		return this.#mapState;
	}

	hide() {
		this.dataLayer.setMap(null);
	}

	show() {
		this.dataLayer.setMap(this.#mapState.map);
	}

	delete() {
		this.dataLayer.setMap(null);
		this.#mapState.deleteDataLayer(this.#id);
	}
}

export type GoogleMapsMarkerStates = 'hidden' | 'visible';
type GoogleMapsMarkerEvents = 'hide' | 'show';

type GoogleMapsMarkerStateProps = Omit<google.maps.marker.AdvancedMarkerElementOptions, 'map'> & {
	id: string;
	initialState: GoogleMapsMarkerStates;
};

export class GoogleMapsMarkerState {
	#root: GoogleMapsRootState;
	#mapState: GoogleMapsMapState;
	#id: GoogleMapsMarkerStateProps['id'];
	marker: google.maps.marker.AdvancedMarkerElement;
	state: FiniteStateMachine<GoogleMapsMarkerStates, GoogleMapsMarkerEvents>;

	constructor(props: GoogleMapsMarkerStateProps, mapState: GoogleMapsMapState) {
		const { id, initialState, ...opts } = props;
		this.#mapState = mapState;
		this.#root = mapState.root;
		this.#id = id;
		if (!this.#root.loadedLibraries || !this.#root.loadedLibraries.includes('marker')) {
			throw new Error(
				'Please import the Google Maps "markers" library to use the Marker component.'
			);
		}

		this.marker = new google.maps.marker.AdvancedMarkerElement(opts);
		this.state = this.#initStateMachine(initialState);

		this.#mapState.addMarker(this);
	}

	get id() {
		return this.#id;
	}

	get parent() {
		return this.#mapState;
	}

	hide() {
		if (this.state.current === 'hidden') return;
		this.state.send('hide');
	}

	show() {
		if (this.state.current === 'visible') return;
		this.state.send('show');
	}

	delete() {
		this.marker.map = null; // Remove from map
		this.#mapState.deleteMarker(this.#id);
	}

	#initStateMachine(initialState: GoogleMapsMarkerStates) {
		return new FiniteStateMachine<GoogleMapsMarkerStates, GoogleMapsMarkerEvents>(initialState, {
			hidden: {
				show: 'visible',
				_enter: () => {
					this.marker.map = null;
				}
			},
			visible: {
				hide: 'hidden',
				_enter: () => {
					this.marker.map = this.#mapState.map;
				}
			}
		});
	}
}

export type GoogleMapsPolygonStates = 'hidden' | 'visible';
type GoogleMapsPolygonEvents = 'hide' | 'show';

type GoogleMapsPolygonStateProps = google.maps.PolygonOptions & {
	id: string;
	initialState: GoogleMapsPolygonStates;
};
export class GoogleMapsPolygonState {
	#root: GoogleMapsRootState;
	#mapState: GoogleMapsMapState;
	#id: GoogleMapsPolygonStateProps['id'];
	polygon: google.maps.Polygon;
	state: FiniteStateMachine<GoogleMapsPolygonStates, GoogleMapsPolygonEvents>;

	constructor(props: GoogleMapsPolygonStateProps, mapState: GoogleMapsMapState) {
		const { id, initialState, ...opts } = props;
		this.#mapState = mapState;
		this.#root = mapState.root;
		this.#id = id;
		if (!this.#root.loadedLibraries || !this.#root.loadedLibraries.includes('marker')) {
			throw new Error('Please import the Google Maps "maps" library to use the Polygon component.');
		}

		this.polygon = new google.maps.Polygon(opts);
		this.state = this.#initStateMachine(initialState);
		this.#mapState.addPolygon(this);
	}
	get id() {
		return this.#id;
	}

	get parent() {
		return this.#mapState;
	}

	hide() {
		if (this.state.current === 'hidden') return;
		this.state.send('hide');
	}

	show() {
		if (this.state.current === 'visible') return;
		this.state.send('show');
	}

	delete() {
		this.polygon.setMap(null); // Remove from map
		this.#mapState.deletePolygon(this.#id);
	}

	#initStateMachine(initialState: GoogleMapsMarkerStates) {
		return new FiniteStateMachine<GoogleMapsMarkerStates, GoogleMapsMarkerEvents>(initialState, {
			hidden: {
				show: 'visible',
				_enter: () => {
					this.polygon.setVisible(false);
				}
			},
			visible: {
				hide: 'hidden',
				_enter: () => {
					this.polygon.setMap(this.#mapState.map);
					this.polygon.setVisible(true);
				}
			}
		});
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
	createContext<GoogleMapsRootState>('Maps.Root');

const [setGoogleMapsMapContext, getGoogleMapsMapContext] =
	createContext<GoogleMapsMapState>('Maps.Map');

const [setGoogleMapsMarkerContext, getGoogleMapsMarkerContext] =
	createContext<GoogleMapsMarkerState>('Maps.Marker');

const [setGoogleMapsPolygonContext, getGoogleMapsPolygonContext] =
	createContext<GoogleMapsPolygonState>('Maps.Polygon');

export function useGoogleMapsRoot(props: GoogleMapsRootStateProps) {
	return setGoogleMapsRootContext(new GoogleMapsRootState(props));
}

export function useGoogleMapsMap(props: GoogleMapsMapStateProps) {
	const root = getGoogleMapsRootContext();
	return setGoogleMapsMapContext(new GoogleMapsMapState(props, root));
}

export function useGoogleMapsMarker(props: GoogleMapsMarkerStateProps) {
	const map = getGoogleMapsMapContext();
	return setGoogleMapsMarkerContext(new GoogleMapsMarkerState(props, map));
}

export function useGoogleMapsPolygon(props: GoogleMapsPolygonStateProps) {
	const map = getGoogleMapsMapContext();
	return setGoogleMapsPolygonContext(new GoogleMapsPolygonState(props, map));
}
