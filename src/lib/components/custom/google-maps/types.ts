import { type LoaderOptions } from '@googlemaps/js-api-loader';
import { Expand } from 'svelte-toolbelt';
import type { WithChildren, BitsDivAttributes } from 'bits-ui';

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
			opts?: Omit<google.maps.PolygonOptions, 'visible' | 'map'>;
		}
	>
>;
