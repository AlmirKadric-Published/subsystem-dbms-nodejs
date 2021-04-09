import path from 'path';
import glob from 'tiny-glob';
import semver from 'semver';
import appRoot from 'app-root-path';

import * as dbms from './index';

import loggerFactory from '@catalyststack/subsystem-logger';
const logger = loggerFactory('dbms');

import {
	MigrateDirection,
	MigrateDBVersions,
	IMigrate
} from './types';


//
const migrateCache: MigrateDBVersions = {};


/**
 *
 */
export async function registerMigrateFolder(
	folderGlobPath: string
) : Promise<void> {
	const globOptions = { cwd: appRoot.path };
	const migrateDBPaths = await glob(folderGlobPath, globOptions);

	for (const migrateDBPath of migrateDBPaths) {
		const dbName = path.basename(migrateDBPath);

		const dbVersionsGlob = path.join(migrateDBPath, '*');
		const dbVersionsFiles = await glob(dbVersionsGlob, globOptions);
		for (const dbVersionsFile of dbVersionsFiles) {
			const version = path.basename(dbVersionsFile).replace(/\.[^.]+$/,'');

			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const MigrateModule = require(
				/* webpackIgnore: true */
				path.resolve(appRoot.path, dbVersionsFile)
			);

			const meta = { path: dbVersionsFile };
			registerMigrate(dbName, version, MigrateModule, meta);
		}
	}
}

/**
 *
 */
export function registerMigrate(
	dbName: string,
	version: string,
	MigrateModule: IMigrate,
	meta: unknown,
) : void {
	// TODO: validate version using semver

	//
	const dbMigrations = migrateCache[dbName] = migrateCache[dbName] || {};
	const versionMigrations = dbMigrations[version] = dbMigrations[version] || [];

	//
	logger.info('Registering migration script:', `${dbName}@${version}`);
	versionMigrations.push({ dbName, version, MigrateModule, meta });
}

/**
 *
 */
export async function dbCreate(
	dbName: string,
) : Promise<void> {
	const client = dbms.getConnector(dbName);
	await client.dbCreate();
}

/**
 *
 */
export async function dbMigrate(
	dbName: string,
	targetVersion: string | null,
) : Promise<void> {
	const client = dbms.getConnector(dbName);

	//
	const currentVersion = await client.versionGet();

	//
	let direction: MigrateDirection;
	if (currentVersion === null && targetVersion === null) {
		logger.info('Current and target versions are the same, no action to be taken');
		return;
	} else if (
		currentVersion === null ||
		(targetVersion !== null && semver.gt(targetVersion, currentVersion))
	) {
		logger.info('Migrating up to version:', targetVersion);
		direction = MigrateDirection.up;
	} else if (
		targetVersion === null ||
		(currentVersion !== null && semver.lt(targetVersion, currentVersion))
	) {
		logger.info('Migrating down to version', targetVersion);
		direction = MigrateDirection.down;
	} else {
		logger.info('Current and target versions are the same, no action to be taken');
		return;
	}

	//
	const dbMigrations = migrateCache[dbName];
	if (!dbMigrations) {
		logger.info('No migrations found for db:', dbName);
		return;
	}

	//
	const versions = Object.keys(dbMigrations);
	if (targetVersion !== null && versions.indexOf(targetVersion) < 0) {
		versions.push(targetVersion);
	}
	if (currentVersion !== null && versions.indexOf(currentVersion) < 0) {
		versions.push(currentVersion);
	}

	//
	let versionLower, versionUpper;
	if (currentVersion === null) {
		versionLower = currentVersion;
		versionUpper = targetVersion;
	} else if (targetVersion === null) {
		versionLower = targetVersion;
		versionUpper = currentVersion;
	} else if (semver.gt(targetVersion, currentVersion)) {
		versionLower = currentVersion;
		versionUpper = targetVersion;
	} else {
		versionLower = targetVersion;
		versionUpper = currentVersion;
	}

	//
	versions.sort(semver.compare);
	if (versionLower !== null) {
		const currentI = versions.indexOf(versionLower);
		versions.splice(0, currentI + 1);
	}
	if (versionUpper !== null) {
		const targetI = versions.indexOf(versionUpper);
		versions.splice(targetI + 1, versions.length - targetI - 1);
	}

	//
	if (direction === MigrateDirection.down) {
		versions.reverse();
	}

	//
	for (const version of versions) {
		if (!Object.prototype.hasOwnProperty.call(dbMigrations, version)) {
			continue;
		}

		const migrations = dbMigrations[version];
		for (const migration of migrations) {
			logger.debug('Executing:', dbName, version, direction);
			logger.debug(JSON.stringify(migration.meta, null, '  '));
			switch (direction) {
				case MigrateDirection.up:
					await migration.MigrateModule.up(client);
					break;
				case MigrateDirection.down:
					await migration.MigrateModule.down(client);
					break;
				default:
					throw new Error('');
			}
		}
	}

	//
	await client.versionSet(targetVersion);
}

/**
 *
 */
export async function dbDrop(
	dbName: string,
) : Promise<void> {
	const client = dbms.getConnector(dbName);
	await client.dbDrop();
}

/**
 *
 */
export async function create() : Promise<void> {
	logger.notice('Creating all application databases');

	const dbNames = Object.keys(migrateCache);
	for (const dbName of dbNames) {
		await dbCreate(dbName);
	}

	logger.notice('All application databases have been created');
}

/**
 *
 */
export async function migrate(
	targetVersion: string | null,
) : Promise<void> {
	logger.notice('Migrating all application databases');

	const dbNames = Object.keys(migrateCache);
	for (const dbName of dbNames) {
		await dbMigrate(dbName, targetVersion);
	}

	logger.notice('All application databases have been migrated');
}

/**
 *
 */
export async function drop() : Promise<void> {
	logger.notice('Dropping all application databases');

	const dbNames = Object.keys(migrateCache);
	for (const dbName of dbNames) {
		await dbDrop(dbName);
	}

	logger.notice('All application databases have been dropped');
}
