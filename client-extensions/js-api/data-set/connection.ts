/**
 * SPDX-FileCopyrightText: © 2020 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

/**
 * Public type contracts for the Frontend Data Set (FDS) connection and
 * remote state. `FDSConnection` (and its companion
 * `FDSConnectionConstructor`) let a Client Extension read and write FDS
 * search state and take its filtering over, while `FDSConnectionInfo`,
 * `FDSConnectionStatus`, `FDSConnectionOptions`, and
 * `FDSStateChangeCallback` describe how a connection is opened and
 * observed.
 *
 * Filtering belongs either to the data set or to the Client Extension,
 * never to both. `getFilters()` hands over the filters the data set declares
 * in its configuration, as they stood when the connection became ready, for
 * the Client Extension to obey or ignore. `setFilters()` then takes the
 * filtering over: from the first call on, the declared filters no longer
 * reach the request, and the Client Extension owns the whole filter
 * expression, obeying the declared ones by including them in the set it
 * passes. `clearFilters()` leaves nothing applied without giving the
 * filtering back, and runs on `disconnect()`. Pair all of this with a data
 * set whose filter UI is hidden, so that filtering has a single owner.
 *
 * Unlike the other contracts in this package, `FDSConnection` is declared
 * here as both a value (the constructor) and a type (the instance), so
 * consumers can `new FDSConnection(...)` and annotate with `FDSConnection`
 * exactly as they would a class. At runtime the connection is implemented
 * and served by the portal as the `@liferay/frontend-data-set-web/api` ES
 * module and resolved through the import map. A Client Extension redirects
 * that import-map specifier to this module at build time (via a `tsconfig`
 * `paths` entry) so it can construct a connection with full typing while
 * the value is pulled from the import-map module at runtime.
 */

/**
 * Filter applied by a Client Extension, through `setFilters()`. Only the
 * final OData expression crosses the boundary: how the Client Extension
 * collects the values behind it is its own business. Each expression is
 * wrapped in parentheses and joined with the others through "and", so it
 * must be self-contained and balanced.
 */
export interface FDSConnectionFilter {
	id: string;
	odataFilterString: string;
}

/**
 * The kind of value a filter matches, which decides the shape of the OData
 * a Client Extension has to produce for it: a quoted literal for a string, a
 * bare one for a number, `field/any(x:(x eq ...))` for a collection.
 */
export type FDSFilterEntityFieldType =
	| 'boolean'
	| 'collection'
	| 'collection-integer'
	| 'collection-string'
	| 'date'
	| 'date-time'
	| 'integer'
	| 'string';

/** One of the values a selection filter offers. */
export interface FDSSelectionFilterItem {
	label: string;
	value: string;
}

/**
 * What a selection filter matches: the values picked, and whether the filter
 * keeps them or leaves them out.
 */
export interface FDSSelectionFilterSelection {
	exclude: boolean;
	items: Array<FDSSelectionFilterItem>;
}

/**
 * Where a selection filter takes its values from when it offers more than a
 * fixed list: the endpoint to query as the user types, and the fields to read
 * each value and its label from.
 */
export interface FDSSelectionFilterAutocomplete {
	apiURL: string;
	itemKey: string;
	itemLabel: string;
	placeholder: string;
}

/**
 * A moment a date filter is bounded by, or picked at, as wall clock values.
 * `hour` and `minute` come with `dateTimeRange` filters only.
 */
export interface FDSFilterDate {
	day: number;
	hour?: number;
	minute?: number;
	month: number;

	/**
	 * UTC offset the moment was picked at, such as "+02:00", when the data
	 * set recorded one. Without it, read the moment in the viewer's time zone.
	 */
	offset?: string;
	year: number;
}

/** A bound that follows the clock rather than standing still. */
export type FDSFilterDateBound = FDSFilterDate | 'now';

/** What a date filter matches: a range open at either end. */
export interface FDSFilterDateSelection {
	from: FDSFilterDate | null;
	to: FDSFilterDate | null;
}

interface FDSBaseFilterInfo {
	active: boolean;
	entityFieldType: FDSFilterEntityFieldType;
	id: string;
	label: string;

	/**
	 * Empty while the filter is inactive, since the data set computes the
	 * expression from the selected values only once the filter is applied.
	 */
	odataFilterString: string;
}

/**
 * A filter that matches a field against picked values.
 *
 * `items` holds the values it offers, empty when `autocomplete` is set and
 * they are fetched instead. `preselection` is what the configuration picks on
 * the data set's behalf, and is what a Client Extension has to start from to
 * behave the way the data set would have.
 */
export interface FDSSelectionFilterInfo extends FDSBaseFilterInfo {
	autocomplete: FDSSelectionFilterAutocomplete | null;
	items: Array<FDSSelectionFilterItem>;
	multiple: boolean;
	preselection: FDSSelectionFilterSelection | null;
	selection: FDSSelectionFilterSelection | null;
	type: 'selection';
}

/**
 * A filter that matches a date, or a date and a time, against a range.
 *
 * `min` and `max` are the bounds the configuration allows, either absent.
 * `preselection` is the range the configuration picks on the data set's
 * behalf, and is what a Client Extension has to start from to behave the way
 * the data set would have.
 */
export interface FDSDateRangeFilterInfo extends FDSBaseFilterInfo {
	max: FDSFilterDateBound | null;
	min: FDSFilterDateBound | null;
	preselection: FDSFilterDateSelection | null;
	selection: FDSFilterDateSelection | null;
	type: 'dateRange' | 'dateTimeRange';
}

/**
 * A filter the data set declares in its configuration, as handed over by
 * `getFilters()`. It travels the other way around from
 * `FDSConnectionFilter`: the data set describes what it declares, and a
 * Client Extension that takes the filtering over reads it to obey those
 * filters, or to offer them again in its own UI.
 *
 * Narrow on `type` to reach what a filter matches. Everything is resolved
 * here, which is what the connection adds on top of the entries the data set
 * holds: a filter that is not applied has an empty expression and no
 * selection, and a bound the data set would ignore reads as absent.
 *
 * Filters another Client Extension renders are left out: they reach their own
 * extension through the `FDSFilter` contract, which describes both what they
 * match and how they draw it.
 */
export type FDSFilterInfo = FDSDateRangeFilterInfo | FDSSelectionFilterInfo;

/**
 * The data set state, which describes what a connection may influence and
 * nothing else: the search query, and the filters a Client Extension
 * applied. The filters the data set declares in its configuration are
 * deliberately absent, because the data set owns them: they reach a Client
 * Extension through `getFilters()` instead, and writing them is not part of
 * this contract.
 *
 * A Client Extension never writes this state: it calls `setSearch()` and
 * `setFilters()`, and the provider writes. Every member is readonly because
 * no member is ever changed in place — the provider replaces each one whole,
 * spreading a state it read back deep frozen, which a mutable type would
 * reject.
 */
export interface FDSState {
	readonly connectionFilters?: ReadonlyArray<FDSConnectionFilter>;
	readonly search: {readonly query: string};
}

export interface FDSStateChangeCallback {
	search: (query: string) => void;
}

export interface FDSConnectionOptions {
	timeout?: number;
}

export interface FDSConnectionInfo {
	fdsName: string;
	instanceId: number;
	status: FDSConnectionStatus;
}

export type FDSConnectionStatus =
	| 'connecting'
	| 'ready'
	| 'timeout'
	| 'disconnected';

export interface FDSConnection {
	clearFilters: () => void;
	disconnect: () => void;
	getFilters: () => Array<FDSFilterInfo> | null;
	getSearch: () => string | null;
	setFilters: (filters: Array<FDSConnectionFilter>) => void;
	setSearch: (query: string) => void;
}

export interface FDSConnectionConstructor {
	new (
		fdsName: string,
		fdsStateChangeCallback: FDSStateChangeCallback,
		onFDSConnectionInfoChange: (
			fdsConnectionInfo: FDSConnectionInfo
		) => void,
		options?: FDSConnectionOptions
	): FDSConnection;
}

// `FDSConnection` intentionally uses PascalCase: it is a class-like
// constructor (typed as `FDSConnectionConstructor`), not a plain variable.
// The `const` value and the `FDSConnection` interface above share the same
// name so consumers can use it as both a value and a type, like a class.

// eslint-disable-next-line @typescript-eslint/naming-convention
export declare const FDSConnection: FDSConnectionConstructor;
