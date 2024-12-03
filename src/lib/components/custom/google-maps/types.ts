import { type LoaderOptions } from '@googlemaps/js-api-loader';

import type { WithChildren, BitsDivAttributes } from 'bits-ui';

export type GoogleMapsRootProps = WithChildren<{
	libraries: NonNullable<LoaderOptions['libraries']>;
	apiKey?: LoaderOptions['apiKey'];
	version?: LoaderOptions['version'];
	region?: LoaderOptions['region'];
}>;

export type GoogleMapsMapProps = BitsDivAttributes &
	WithChildren<{
		mapId?: string;
		config?: Omit<google.maps.MapOptions, 'mapId' | 'container'>;
	}>;
