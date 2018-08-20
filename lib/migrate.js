'use strict';

const semver = require('semver');

const requirePeer = require('codependency').get('@catalyststack/subsystem-dbms');
const logger = requirePeer('@catalyststack/subsystem-logger')('dbms');

const dbms = require('.');


const migrateCache = {};


/**
 *
 * @param dbName
 * @param version
 * @param module
 * @param meta
 */
exports.registerMigrate = (dbName, version, module, meta) => {
	// TODO: validate version using semver

	//
	const dbMigrations = migrateCache[dbName] = migrateCache[dbName] || {};
	const versionMigrations = dbMigrations[version] = dbMigrations[version] || [];

	//
	logger.info('Registering migration script:', `${dbName}@${version}`);
	versionMigrations.push({ dbName, version, module, meta });
};

/**
 *
 */
exports.dbCreate = async (dbName) => {
	const client = dbms.getConnector(dbName);
	await client.dbCreate();
};

/**
 *
 * @param dbName
 * @param targetVersion
 */
exports.dbMigrate = async (dbName, targetVersion) => {
	const client = dbms.getConnector(dbName);

	//
	const currentVersion = await client.versionGet();

	//
	let direction;
	if (!currentVersion || semver.gt(targetVersion, currentVersion)) {
		logger.info('Migrating up to version:', targetVersion);
		direction = 'up';
	} else if (semver.lt(targetVersion, currentVersion)) {
		logger.info('Migrating down to version', targetVersion);
		direction = 'down';
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
	if (versions.indexOf(targetVersion) < 0) {
		versions.push(targetVersion);
	}
	if (currentVersion && versions.indexOf(currentVersion) < 0) {
		versions.push(currentVersion);
	}

	//
	versions.sort(semver.compare);
	if (currentVersion) {
		const currentI = versions.indexOf(currentVersion);
		versions.splice(0, currentI + 1);
	}
	const targetI = versions.indexOf(targetVersion);
	versions.splice(targetI, versions.length - targetI - 1);

	//
	if (direction === 'down') {
		versions.reverse();
	}

	//
	for (const version of versions) {
		if (!dbMigrations.hasOwnProperty(version)) {
			continue;
		}

		const migrations = dbMigrations[version];
		for (const migration of migrations) {
			logger.debug('Executing:', dbName, version, direction);
			logger.debug(JSON.stringify(migration.meta, null, '   '));
			await migration.module[direction](client);
		}
	}

	//
	await client.versionSet(targetVersion);
};

/**
 *
 */
exports.dbDrop = async (dbName) => {
	const client = dbms.getConnector(dbName);
	await client.dbDrop();
};

/**
 *
 */
exports.create = async () => {
	logger.notice('Creating all application databases');

	const dbNames = Object.keys(migrateCache);
	for (const dbName of dbNames) {
		await exports.dbCreate(dbName);
	}

	logger.notice('All application databases have been created');
};

/**
 *
 * @param targetVersion
 */
exports.migrate = async (targetVersion) => {
	logger.notice('Migrating all application databases');

	const dbNames = Object.keys(migrateCache);
	for (const dbName of dbNames) {
		await exports.dbMigrate(dbName, targetVersion);
	}

	logger.notice('All application databases have been migrated');
};

/**
 *
 */
exports.drop = async () => {
	logger.notice('Dropping all application databases');

	const dbNames = Object.keys(migrateCache);
	for (const dbName of dbNames) {
		await exports.dbDrop(dbName);
	}

	logger.notice('All application databases have been dropped');
};
