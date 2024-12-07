import { createContext } from '$lib/internal/create-context.js';
import { Loader, type LoaderOptions } from '@googlemaps/js-api-loader';
import { FiniteStateMachine } from 'runed';
import { SvelteMap } from 'svelte/reactivity';
import type { Expand } from 'svelte-toolbelt';

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

type GoogleMapsDataTypes = GoogleMapsDataLayer | GoogleMapsMarker | GoogleMapsPolygon;

export class GoogleMap {
	root: GoogleMapsApiLoader;
	map: google.maps.Map;
	state = googleMapState;
	data = new SvelteMap<string, GoogleMapsDataTypes>();

	constructor(props: GoogleMapProps, root: GoogleMapsApiLoader) {
		this.root = root;
		if (!this.root.loadedLibraries || !this.root.loadedLibraries.includes('maps')) {
			throw new Error('Please import the Google Maps "maps" library to use the Map component.');
		}
		this.map = new google.maps.Map(props.mapDiv, { mapId: props.mapId, ...props.opts });
	}

	addData(data: GoogleMapsDataTypes) {
		this.data.set(data.id, data);
	}

	deleteData(id: string) {
		this.data.delete(id);
	}

	hideData(id: string) {
		this.data.get(id)?.hide();
	}

	showData(id: string) {
		this.data.get(id)?.show();
	}

	clearData() {
		for (const id of this.data.values()) {
			id.delete();
		}
		this.data.clear();
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

type GoogleMapsDataProps = {
	id: string;
	visible: boolean;
};

type GoogleMapsDataLayerProps = Expand<GoogleMapsDataProps & google.maps.Data.DataOptions>;

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

class GoogleMapsDataLayer {
	#root: GoogleMapsApiLoader;
	#map: GoogleMap;
	#id: GoogleMapsDataLayerProps['id'];
	#visibility: VisibilityStateMachine;
	layer: google.maps.Data;

	constructor(props: GoogleMapsDataLayerProps, map: GoogleMap) {
		const { id, visible, ...opts } = props;
		this.#map = map;
		this.#root = map.root;
		this.#id = id;
		if (!this.#root.loadedLibraries || !this.#root.loadedLibraries.includes('maps')) {
			throw new Error(
				'Please import the Google Maps "maps" library to use the DataLayer component.'
			);
		}

		this.#visibility = visibilityStateMachine(visible, {
			show: () => {
				this.layer.setMap(this.#map.map);
			},
			hide: () => {
				this.layer.setMap(null);
			}
		});

		this.layer = new google.maps.Data(opts);
		this.#map.addData(this);
	}

	get id() {
		return this.#id;
	}

	get parent() {
		return this.#map;
	}

	hide() {
		this.#visibility.send('hide');
	}

	show() {
		this.#visibility.send('show');
	}

	delete() {
		this.layer.setMap(null);
		this.#map.deleteData(this.#id);
	}
}

type GoogleMapsMarkerProps = Expand<
	GoogleMapsDataProps & Omit<google.maps.marker.AdvancedMarkerElementOptions, 'map'>
>;

export class GoogleMapsMarker {
	#root: GoogleMapsApiLoader;
	#map: GoogleMap;
	#id: GoogleMapsMarkerProps['id'];
	#visibility: VisibilityStateMachine;
	marker: google.maps.marker.AdvancedMarkerElement;

	constructor(props: GoogleMapsMarkerProps, map: GoogleMap) {
		const { id, visible, ...opts } = props;
		this.#map = map;
		this.#root = map.root;
		this.#id = id;
		if (!this.#root.loadedLibraries || !this.#root.loadedLibraries.includes('marker')) {
			throw new Error(
				'Please import the Google Maps "markers" library to use the Marker component.'
			);
		}

		this.marker = new google.maps.marker.AdvancedMarkerElement(opts);
		this.#visibility = visibilityStateMachine(visible, {
			show: () => {
				this.marker.map = this.#map.map;
			},
			hide: () => {
				this.marker.map = null;
			}
		});

		this.#map.addData(this);
	}

	get id() {
		return this.#id;
	}

	get parent() {
		return this.#map;
	}

	hide() {
		this.#visibility.send('hide');
	}

	show() {
		this.#visibility.send('show');
	}

	delete() {
		this.marker.map = null; // Remove from map
		this.#map.deleteData(this.#id);
	}
}
type GoogleMapsPolygonProps = Expand<
	GoogleMapsDataProps & Omit<google.maps.PolygonOptions, 'visible' | 'map'>
>;

export class GoogleMapsPolygon {
	#root: GoogleMapsApiLoader;
	#map: GoogleMap;
	#id: GoogleMapsPolygonProps['id'];
	#visibility: VisibilityStateMachine;
	polygon: google.maps.Polygon;

	constructor(props: GoogleMapsPolygonProps, mapState: GoogleMap) {
		const { id, visible, ...opts } = props;
		this.#map = mapState;
		this.#root = mapState.root;
		this.#id = id;
		if (!this.#root.loadedLibraries || !this.#root.loadedLibraries.includes('marker')) {
			throw new Error('Please import the Google Maps "maps" library to use the Polygon component.');
		}

		this.polygon = new google.maps.Polygon(opts);
		this.#visibility = visibilityStateMachine(visible, {
			show: () => {
				this.polygon.setMap(this.#map.map);
			},
			hide: () => {
				this.polygon.setMap(null);
			}
		});
		this.#map.addData(this);
	}
	get id() {
		return this.#id;
	}

	get parent() {
		return this.#map;
	}

	hide() {
		this.#visibility.send('hide');
	}

	show() {
		this.#visibility.send('show');
	}

	delete() {
		this.polygon.setMap(null); // Remove from map
		this.#map.deleteData(this.#id);
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
	createContext<GoogleMapsApiLoader>('Maps.ApiLoader');

const [setGoogleMapsMapContext, getGoogleMapsMapContext] = createContext<GoogleMap>('Maps.Map');

const [setGoogleMapsMarkerContext, getGoogleMapsMarkerContext] =
	createContext<GoogleMapsMarker>('Maps.Marker');

const [setGoogleMapsPolygonContext, getGoogleMapsPolygonContext] =
	createContext<GoogleMapsPolygon>('Maps.Polygon');

export function useGoogleMapsRoot(props: GoogleMapsApiLoaderProps) {
	return setGoogleMapsRootContext(new GoogleMapsApiLoader(props));
}

export function useGoogleMapsMap(props: GoogleMapProps) {
	const root = getGoogleMapsRootContext();
	return setGoogleMapsMapContext(new GoogleMap(props, root));
}

export function useGoogleMapsMarker(props: GoogleMapsMarkerProps) {
	const map = getGoogleMapsMapContext();
	return setGoogleMapsMarkerContext(new GoogleMapsMarker(props, map));
}

export function useGoogleMapsPolygon(props: GoogleMapsPolygonProps) {
	const map = getGoogleMapsMapContext();
	return setGoogleMapsPolygonContext(new GoogleMapsPolygon(props, map));
}
