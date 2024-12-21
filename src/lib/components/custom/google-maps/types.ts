import type { Expand } from 'svelte-toolbelt';
import type { WithChildren, BitsDivAttributes } from 'bits-ui';
import type { Snippet } from 'svelte';
import type {
	PolygonStyling,
	MapFeatureTypes,
	MapFeatureStateTypes,
	ApiProviderStateProps,
	PolygonFeatureState,
	MarkerFeatureState
} from './google-maps.svelte.js';
import type { ZodObject, infer as zInfer } from 'zod';

type ApiProviderProps = WithChildren<{
	libraries: ApiProviderStateProps['libraries'];
	apiKey: ApiProviderStateProps['apiKey'];
	version?: ApiProviderStateProps['version'];
	language?: ApiProviderStateProps['language'];
	authReferrerPolicy?: ApiProviderStateProps['authReferrerPolicy'];
	region?: ApiProviderStateProps['region'];
	onError?: ApiProviderStateProps['onError'];
}>;

type MapProps = BitsDivAttributes &
	WithChildren<{
		opts?: google.maps.MapOptions;
	}>;

type DataLayerProps<T extends MapFeatureTypes, S extends ZodObject<any>> = {
	id?: string;
	name?: string;
	visible?: boolean;
	filter?: (feature: MapFeatureStateTypes<T, S>) => boolean;
	attributeSchema?: S;
	children?: Snippet<
		[
			{
				attributeSchema: S;
			}
		]
	>;
};

type MarkerLayerProps<T extends ZodObject<any>> = DataLayerProps<'marker', T>;
type PolygonLayerProps<T extends ZodObject<any>> = Expand<
	DataLayerProps<'polygon', T> & { opts?: Omit<google.maps.Data.DataOptions, 'map'> } & {
		defaultStyling?: PolygonStyling;
		hoverStyling?: PolygonStyling;
		clickStyling?: PolygonStyling;
	}
>;

type FeatureProps<T extends ZodObject<any>> = Expand<
	WithChildren<{
		id?: string;
		attributeSchema?: T;
		attributes?: zInfer<T>;
	}>
>;

type MarkerProps<T extends ZodObject<any>> = FeatureProps<T> & {
	position: google.maps.marker.AdvancedMarkerElementOptions['position'];
	opts?: Omit<google.maps.marker.AdvancedMarkerElementOptions, 'map' | 'position'>;
};

type PolygonProps<T extends ZodObject<any>> = FeatureProps<T> & {
	geometry: Array<
		google.maps.Data.LinearRing | Array<google.maps.LatLng | google.maps.LatLngLiteral>
	>;
};

export type {
	ApiProviderProps,
	MapProps,
	PolygonLayerProps,
	MarkerLayerProps,
	MarkerFeatureState as Marker,
	PolygonFeatureState as Polygon,
	PolygonProps,
	MarkerProps
};
