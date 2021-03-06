/**
 * SPDX-FileCopyrightText: © 2017 Liferay, Inc. <https://liferay.com>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

/**
 * A class to help modifying JSON files.
 */
export default class JsonModifier {

	/**
	 * @param {Generator} generator a Yeoman generator
	 * @param {String} path path to file
	 * @param space the space string/number of spaces to use when stringifying
	 */
	constructor(generator, path, space: string | number = '	') {
		this._generator = generator;
		this._path = path;
		this._space = space;
	}

	/**
	 * Get the JSON object associated to this modifier
	 * @return {Object} a parsed JSON object
	 */
	get json(): object {
		return JSON.parse(this._generator.fs.read(this._path));
	}

	/**
	 * Modify an existing JSON file.
	 * @param {Function} modifier the code that modifies the JSON (it receives a
	 * 						single parameter with the JSON object)
	 */
	modifyJson(modifier): void {
		const gen = this._generator;

		const json = this.json;

		modifier(json);

		gen.fs.write(this._path, JSON.stringify(json, null, this._space));
	}

	/**
	 * Escape a property name to make it suitable for use in dot-prop
	 * @param {string} name name of property
	 * @return {string} the escaped name
	 */
	_escapeProp(name): string {
		return name.replace(/\./g, '\\.');
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _generator: any;
	private _path: string;
	private _space: string | number;
}
