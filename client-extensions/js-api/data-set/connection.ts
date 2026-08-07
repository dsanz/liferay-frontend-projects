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
 * never to both. `setFilters()` takes it over: from the first call on, the
 * filters the data set declares no longer reach the request, and the Client
 * Extension owns the whole filter expression. `clearFilters()` leaves nothing
 * applied without giving the filtering back, and runs on `disconnect()`. Pair
 * this with a data set whose filter UI is hidden, so that filtering has a
 * single owner.
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
 * The data set state, which describes what a connection may influence and
 * nothing else: the search query, and the filters a Client Extension
 * applied. The filters the data set declares in its configuration are
 * deliberately absent, because the data set owns them: writing them is not
 * part of this contract.
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
