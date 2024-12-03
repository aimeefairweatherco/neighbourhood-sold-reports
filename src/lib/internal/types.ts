import type { Snippet } from 'svelte';

export type OnChangeFn<T> = (value: T) => void;

export type WithChildren<Props = object> = Props & {
	children?: Snippet | undefined;
};

/**
 * Constructs a new type by omitting properties from type
 * 'T' that exist in type 'U'.
 *
 * @template T - The base object type from which properties will be omitted.
 * @template U - The object type whose properties will be omitted from 'T'.
 * @example
 * type Result = Without<{ a: number; b: string; }, { b: string; }>;
 * // Result type will be { a: number; }
 */
export type Without<T extends object, U extends object> = Omit<T, keyof U>;

export type Arrayable<T> = T[] | T;

export type Fn = () => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFn = (...args: any[]) => any;
