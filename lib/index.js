'use strict';

const codependency = require('codependency');
codependency.register(module, {
	index: ['optionalPeerDependencies']
});

const connectors = require('./connectors');
const migrate = require('./migrate');
const models = require('./models');


let dbConfigs;


//
exports.registerConnectorType = (name, module) => connectors.registerConnectorType(name, module);
exports.registerConnector = (dbName, dbConfig) => connectors.registerConnector(dbName, dbConfig);
exports.getConnector = (dbName) => connectors.getConnector(dbName);

exports.registerMigrate = (dbName, version, module) => migrate.registerMigrate(dbName, version, module);
exports.dbCreate = async (dbName) => await migrate.dbCreate(dbName);
exports.dbMigrate = async (dbName, targetVersion) => await migrate.dbMigrate(dbName, targetVersion);
exports.dbDrop = async (dbName) => await migrate.dbDrop(dbName);
exports.create = async () => await migrate.create();
exports.migrate = async (targetVersion) => await migrate.migrate(targetVersion);
exports.drop = async () => await migrate.drop();

exports.registerModel = (name, module) => models.register(name, module);
exports.getModel = (name) => models.get(name);


/**
 *
 * @param config
 */
exports.setup = async (config) => {
	// Cache the config for later user
	dbConfigs = config || {};

	// Validate config object
	const configType = (Array.isArray(dbConfigs)) ? 'array' : typeof dbConfigs;
	if (configType !== 'object') {
		throw new Error(`Invalid "db" configuration type "${configType}", must be an object map`);
	}

	// Setup each db connector
	for (const dbName of Object.keys(dbConfigs)) {
		connectors.registerConnector(dbName, dbConfigs[dbName]);
	}
};

/**
 *
 */
exports.start = async () => {
	await connectors.start();
};

/**
 *
 */
exports.stop = async () => {
	await connectors.stop();
};
