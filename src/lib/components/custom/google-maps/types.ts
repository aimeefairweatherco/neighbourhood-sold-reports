import { type LoaderOptions } from '@googlemaps/js-api-loader';

import type { WithChildren, BitsDivAttributes } from 'bits-ui';
import type { GoogleMapsMarkerStates, GoogleMapsPolygonStates } from './google-maps.svelte';

export type GoogleMapsRootProps = WithChildren<{
	libraries: NonNullable<LoaderOptions['libraries']>;
	apiKey?: LoaderOptions['apiKey'];
	version?: LoaderOptions['version'];
	region?: LoaderOptions['region'];
}>;

export type GoogleMapsMapProps = BitsDivAttributes &
	WithChildren<{
		opts?: google.maps.MapOptions;
	}>;

export type GoogleMapsMarkerProps = WithChildren<{
	id?: string;
	initialState?: GoogleMapsMarkerStates;
	opts?: google.maps.marker.AdvancedMarkerElementOptions;
}>;

export type GoogleMapsPolygonProps = WithChildren<{
	id?: string;
	initialState?: GoogleMapsPolygonStates;
	opts?: google.maps.PolygonOptions;
}>;
