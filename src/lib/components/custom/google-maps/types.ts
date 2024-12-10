import { type LoaderOptions } from '@googlemaps/js-api-loader';
import type { Expand } from 'svelte-toolbelt';
import type { WithChildren, BitsDivAttributes } from 'bits-ui';
import type { PolygonStyling } from './google-maps.svelte.js';

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

type SharedProps = {
	id?: string;
	visible?: boolean;
};

type DataLayerProps = Expand<
	WithChildren<
		SharedProps & {
			name?: string;
		}
	>
>;

export type MarkerLayerProps = DataLayerProps;
export type PolygonLayerProps = Expand<
	DataLayerProps & { opts?: Omit<google.maps.Data.DataOptions, 'map'> } & {
		defaultStyling?: PolygonStyling;
		hoverStyling?: PolygonStyling;
		clickStyling?: PolygonStyling;
	}
>;

export type GoogleMapsMarkerProps = Expand<
	WithChildren<
		SharedProps & {
			opts?: Omit<google.maps.marker.AdvancedMarkerElementOptions, 'map'>;
		}
	>
>;

export type GoogleMapsPolygonProps = Expand<
	WithChildren<
		SharedProps & {
			geometry: Array<
				google.maps.Data.LinearRing | Array<google.maps.LatLng | google.maps.LatLngLiteral>
			>;
		}
	>
>;
