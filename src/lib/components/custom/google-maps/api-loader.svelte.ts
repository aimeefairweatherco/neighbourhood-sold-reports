import { Loader, type LoaderOptions, type Library } from '@googlemaps/js-api-loader';
import { browser } from '$app/environment';
import { deepEqual } from '$lib/internal/object';

type GoogleMapsApiNames = Library;

type ApiStates = 'NOT_LOADED' | 'LOADING' | 'LOADED' | 'ERROR' | 'AUTH_ERROR';

type GoogleMapsApiState = {
	[K in GoogleMapsApiNames]: ApiStates;
};

export type GoogleMapsApiLoaderProps = {
	version: NonNullable<LoaderOptions['version']>;
	apiKey: LoaderOptions['apiKey'];
	libraries: Exclude<Library, 'core'>[];
	region?: NonNullable<LoaderOptions['region']>;
	authReferrerPolicy?: LoaderOptions['authReferrerPolicy'];
	language?: LoaderOptions['language'];
};

export class GoogleMapsApiLoader {
	#initialOptions = $state<GoogleMapsApiLoaderProps | null>(null);
	#loader = $state<Loader | null>(null);
	#apis = $state<GoogleMapsApiState>({
		core: 'NOT_LOADED',
		maps: 'NOT_LOADED',
		places: 'NOT_LOADED',
		geocoding: 'NOT_LOADED',
		routes: 'NOT_LOADED',
		marker: 'NOT_LOADED',
		geometry: 'NOT_LOADED',
		elevation: 'NOT_LOADED',
		streetView: 'NOT_LOADED',
		journeySharing: 'NOT_LOADED',
		drawing: 'NOT_LOADED',
		visualization: 'NOT_LOADED'
	});

	constructor() {}

	init(props: GoogleMapsApiLoaderProps) {
		if (!browser) return;

		if (this.#initialOptions) {
			// Compare initial options (excluding libraries) to ensure immutability
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { libraries: initialLibs, ...initialOptions } = this.#initialOptions;
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { libraries: newLibs, ...newOptions } = props;

			if (!deepEqual(initialOptions, newOptions)) {
				console.warn(
					'[GoogleMapsApiLoader] Already initialized with different options. ' +
						'New options have been ignored. To change options, re-render the app.'
				);
				console.warn('Initial options:', initialOptions);
				console.warn('New options:', newOptions);
			}
		} else {
			this.#initialOptions = props;
		}

		if (!this.#loader) {
			this.#loader = new Loader({
				apiKey: props.apiKey,
				version: props.version,
				authReferrerPolicy: props.authReferrerPolicy,
				language: props.language,
				region: props.region
			});
		}
	}

	get apis() {
		return this.#apis;
	}

	loader = $derived(this.#loader);

	loadedLibraries = $derived(
		(Object.keys(this.#apis) as GoogleMapsApiNames[]).filter((api) => this.#apis[api] === 'LOADED')
	);

	async loadLibraries<T extends GoogleMapsApiNames>(apis: T[]): Promise<void> {
		if (!browser) return;
		if (!this.#loader) return;

		if (apis.length === 0) return;

		const apiSet = new Set(apis);

		// Array to hold all loading promises
		const loadPromises: Promise<void>[] = [];

		for (const api of apiSet) {
			if (this.#apis[api] !== 'NOT_LOADED') continue;

			this.#apis[api] = 'LOADING';

			const loadPromise = this.#loader
				.importLibrary(api)
				.then(() => {
					this.#apis[api] = 'LOADED';
				})
				.catch((e) => {
					console.error(`Error loading Google Maps '${api}' library:`, e);
					this.#apis[api] = 'ERROR';
					// Rethrow so the provider can handle it
					throw e;
				});

			loadPromises.push(loadPromise);
		}

		// If any fail, Promise.all rejects and error bubbles up
		await Promise.all(loadPromises);
	}
}
