import { type Library, type LoaderOptions } from '@googlemaps/js-api-loader';
import type { Expand } from 'svelte-toolbelt';
import type { WithChildren, BitsDivAttributes } from 'bits-ui';
import type {
	PolygonStyling,
	MapFeatureTypes,
	MapMarker,
	MapPolygon,
	GoogleMapsApiProviderProps
} from './google-maps.svelte.js';

export type GoogleMapsRootProps = WithChildren<{
	libraries: GoogleMapsApiProviderProps['libraries'];
	apiKey: GoogleMapsApiProviderProps['apiKey'];
	version?: GoogleMapsApiProviderProps['version'];
	language?: GoogleMapsApiProviderProps['language'];
	authReferrerPolicy?: GoogleMapsApiProviderProps['authReferrerPolicy'];
	region?: GoogleMapsApiProviderProps['region'];
	onError?: GoogleMapsApiProviderProps['onError'];
}>;

export type GoogleMapsMapProps = BitsDivAttributes &
	WithChildren<{
		opts?: google.maps.MapOptions;
	}>;

type SharedProps = {
	id?: string;
};

type DataLayerProps<T extends MapFeatureTypes> = Expand<
	WithChildren<
		SharedProps & {
			name?: string;
			visible?: boolean;
			filter?: (feature: T) => boolean;
		}
	>
>;

export type MarkerLayerProps = DataLayerProps<MapMarker>;
export type PolygonLayerProps = Expand<
	DataLayerProps<MapPolygon> & { opts?: Omit<google.maps.Data.DataOptions, 'map'> } & {
		defaultStyling?: PolygonStyling;
		hoverStyling?: PolygonStyling;
		clickStyling?: PolygonStyling;
	}
>;

export type GoogleMapsMarkerProps = Expand<
	WithChildren<
		SharedProps & {
			position: google.maps.marker.AdvancedMarkerElementOptions['position'];
			opts?: Omit<google.maps.marker.AdvancedMarkerElementOptions, 'map' | 'position'>;
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
