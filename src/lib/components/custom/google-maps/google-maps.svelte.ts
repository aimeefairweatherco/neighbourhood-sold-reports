import { createContext } from '$lib/internal/create-context.js';
import { Loader, type LoaderOptions } from '@googlemaps/js-api-loader';
import { FiniteStateMachine } from 'runed';

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
	status = apiState;

	constructor(props: GoogleMapsRootStateProps) {
		this.#libraries = props.libraries;
		this.#version = props.version;
		this.#apiKey = props.apiKey;
		this.#region = props.region;
	}

	async loadLibraries() {
		if (typeof window === 'undefined') {
			// If running on the server, do not attempt to load the libraries
			return false;
		}
		try {
			const loader = new Loader({
				apiKey: this.#apiKey,
				version: this.#version,
				libraries: this.#libraries,
				region: this.#region
			});

			const loadLibraries = this.#libraries.map((library) => loader.importLibrary(library));
			this.status.send('startLoading');
			await Promise.all(loadLibraries);
			this.status.send('toggleLoaded');
		} catch (error) {
			console.error('Error loading Google Maps libraries:', error);
			this.status.send('toggleError');
		}
	}
}

type MapStates = 'idle' | 'zooming' | 'panning';
type MyEvents = 'toggleZooming' | 'togglePanning';
const mapState = new FiniteStateMachine<MapStates, MyEvents>('idle', {
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
	container: HTMLDivElement;
	mapId: string;
	config?: Omit<google.maps.MapOptions, 'mapId' | 'container'>;
};

export class GoogleMapsMapState {
	#root: GoogleMapsRootState;
	mapState = mapState;
	map: google.maps.Map;
	markers = $state<google.maps.marker.AdvancedMarkerElement[]>([]);
	polygons = $state<google.maps.Polygon[]>([]);

	constructor(props: GoogleMapsMapStateProps, root: GoogleMapsRootState) {
		this.#root = root;
		if (this.#root.status.current !== 'loaded') {
			throw new Error('Google Maps libraries are not loaded');
		}
		this.map = new google.maps.Map(props.container, { mapId: props.mapId, ...props.config });
	}

	smoothZoom = async (targetZoomLevel: number, location?: LatLng) => {
		const initialZoomLevel = this.map.getZoom();
		if (initialZoomLevel === undefined) return;

		if (location) {
			await this.#panAndZoom(targetZoomLevel, initialZoomLevel, location);
		} else {
			await this.#zoomTo(targetZoomLevel);
		}
		if (this.mapState.current === 'zooming') this.mapState.send('toggleZooming');
		console.log('FINAL ZOOM LVL: ', this.map.getZoom());
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
		console.log(`POINT IN BOUNDS AT: ${this.map.getZoom()}`);
		this.mapState.send('togglePanning');
		console.log(`START PANNING`);
		this.map.panTo(location);

		await new Promise<void>((resolve) => {
			google.maps.event.addListenerOnce(this.map, 'idle', async () => {
				console.log(`STOP PANNING`);
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
		if (this.mapState.current !== 'zooming') this.mapState.send('toggleZooming');
		setTimeout(() => {
			this.map.setZoom(zoomLevel);
		}, 30);
	};
}

/*
type GoogleMapsMarkerStateProps = {
    position?: google.maps.marker.AdvancedMarkerElementOptions['position'];
    options?: Omit<google.maps.marker.AdvancedMarkerElementOptions, 'map' | 'position'>;
}
export class GoogleMapsMarkerState {
    #mapState: GoogleMapsMapState;
	position: GoogleMapsMarkerStateProps['position'] = $state(null);
	options: GoogleMapsMarkerStateProps['options'];

	constructor(props: GoogleMapsMarkerStateProps, mapState: GoogleMapsMapState) {
        this.#mapState = mapState;
		this.position = props.position;
		this.options = props.options
	}
}

type GoogleMapsPolygonStateProps = Omit<google.maps.PolygonOptions, 'map'> & {
    map: GoogleMapsMapState | null;
    paths: google.maps.PolygonOptions['paths'];
};
export class GoogleMapsPolygonState {
    map: GoogleMapsPolygonStateProps['map'];
    paths: GoogleMapsPolygonStateProps['paths'];
    options: GoogleMapsPolygonStateProps['options'];

    constructor(props: GoogleMapsPolygonStateProps) {
        this.map = props.map;
        this.paths = props.paths;
        this.options = props.options

    }
}

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

export function useGoogleMapsRoot(props: GoogleMapsRootStateProps) {
	return setGoogleMapsRootContext(new GoogleMapsRootState(props));
}

export function useGoogleMapsMap(props: GoogleMapsMapStateProps) {
	const root = getGoogleMapsRootContext();
	return setGoogleMapsMapContext(new GoogleMapsMapState(props, root));
}
