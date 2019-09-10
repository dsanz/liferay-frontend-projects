/**
 * © 2017 Liferay, Inc. <https://liferay.com>
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import fs from 'fs-extra';
import * as gl from 'liferay-npm-build-tools-common/lib/globs';
import PluginLogger from 'liferay-npm-build-tools-common/lib/plugin-logger';
import project from 'liferay-npm-build-tools-common/lib/project';
import path from 'path';

import * as config from '../config';
import * as log from '../log';
import report from '../report';
import {findFiles, getDestDir, runInChunks} from './util';

/**
 * Run configured rules.
 * @param {PkgDesc} rootPkg the root package descriptor
 * @param {Array<PkgDesc>} depPkgs dependency package descriptors
 * @return {Promise}
 */
export default function runRules(rootPkg, depPkgs) {
	const dirtyPkgs = [rootPkg, ...depPkgs].filter(srcPkg => !srcPkg.clean);

	return Promise.all(dirtyPkgs.map(srcPkg => processPackage(srcPkg))).then(
		() => log.debug(`Applied rules to ${dirtyPkgs.length} packages`)
	);
}

/**
 *
 * @param {PkgDesc} srcPkg
 * @param {number} chunkIndex
 * @return {Promise}
 */
function processPackage(srcPkg) {
	log.debug(`Applying rules to package '${srcPkg.id}'...`);

	const sourceGlobs = srcPkg.isRoot
		? project.sources.map(source => `${source}/**/*`)
		: ['**/*'];

	const globs = [...sourceGlobs, '!node_modules/**/*'];

	const prjSrcFiles = findFiles(
		project.dir,
		gl.prefix(`${project.dir}/${srcPkg.dir}/`, globs)
	);

	const destPkg = srcPkg.clone({
		dir: getDestDir(srcPkg),
	});

	return runInChunks(
		prjSrcFiles,
		config.bundler.getMaxParallelFiles(),
		0,
		prjSrcFile => processFile(srcPkg, destPkg, prjSrcFile)
	);
}

/**
 *
 * @param {PkgDesc} srcPkg
 * @param {PkgDesc} destPkg
 * @param {string} prjSrcFile
 * @return {Promise}
 */
function processFile(srcPkg, destPkg, prjSrcFile) {
	const loaders = project.rules.loadersForFile(
		path.join(project.dir, prjSrcFile)
	);

	if (loaders.length == 0) {
		return Promise.resolve();
	}

	const context = {
		content: fs
			.readFileSync(path.join(project.dir, prjSrcFile), 'utf-8')
			.toString(),
		filePath: prjSrcFile,
		extraArtifacts: {},
		log: new PluginLogger(),
	};

	return runLoaders(loaders, 0, context)
		.then(() => writeLoadersResult(srcPkg, destPkg, context))
		.then(() => report.rulesRun(prjSrcFile, context.log));
}

/**
 * Run rule loaders contained in an array starting at given index.
 * @param {Array<object>} loaders
 * @param {number} firstLoaderIndex
 * @param {object} context the context object to pass to loaders
 * @return {Promise}
 */
function runLoaders(loaders, firstLoaderIndex, context) {
	if (firstLoaderIndex >= loaders.length) {
		return Promise.resolve(context.content);
	}

	const loader = loaders[firstLoaderIndex];

	let result;

	try {
		result = loader.exec(context, loader.options);
	} catch (err) {
		err.message = `Loader '${loader.use}' failed: ${err.message}`;
		throw err;
	}

	return Promise.resolve(result).then(content => {
		if (content !== undefined) {
			context = Object.assign(context, {content});
		}

		return runLoaders(loaders, firstLoaderIndex + 1, context);
	});
}

/**
 *
 * @param {PkgDesc} srcPkg
 * @param {PkgDesc} destPkg
 * @param {object} context
 */
function writeLoadersResult(srcPkg, destPkg, context) {
	if (context.content != undefined) {
		writeRuleFile(
			destPkg,
			path.relative(srcPkg.dir, path.join(project.dir, context.filePath)),
			context.content
		);
	}

	Object.entries(context.extraArtifacts).forEach(
		([prjExtraFile, content]) => {
			if (content == undefined) {
				return;
			}

			writeRuleFile(
				destPkg,
				path.relative(srcPkg.dir, path.join(project.dir, prjExtraFile)),
				content
			);

			context.log.info(
				'liferay-npm-bundler',
				`Rules generated extra artifact: ${prjExtraFile}`
			);
		}
	);
}

/**
 * Write a file generated by a rule for a given destination package.
 * @param {PkgDesc} destPkg
 * @param {string} pkgFile
 * @param {string} content
 */
function writeRuleFile(destPkg, pkgFile, content) {
	if (destPkg.isRoot) {
		pkgFile = stripSourceDir(pkgFile);
	}

	const absFile = path.join(project.dir, destPkg.dir, pkgFile);

	fs.ensureDirSync(path.dirname(absFile));
	fs.writeFileSync(absFile, content);
}

/**
 * String configured source prefixes from package file path.
 * @param {string} pkgFile
 */
export function stripSourceDir(pkgFile) {
	for (const source of project.sources.asPlatform) {
		const prefix = `${source}${path.sep}`;

		if (pkgFile.startsWith(prefix)) {
			return pkgFile.substring(prefix.length);
		}
	}

	return pkgFile;
}