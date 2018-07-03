'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('subsystem-logger')('db');


let dbConfigs;

const dbConnectorTypes = {};
const dbConnectorCache = {};


/**
 *
 * @param name
 * @param module
 */
exports.registerConnectorType = (name, module) => {
	logger.info('Registering db connector type:', name);
	if (dbConnectorTypes.hasOwnProperty(name)) {
		logger.info('Connector type', name, 'already exists, overwriting');
	}

	dbConnectorTypes[name] = module;
};

/**
 *
 * @returns {Promise<void>}
 */
exports.setup = async (config) => {
	// Cache the config for later user
	dbConfigs = config || {};

	// Register default connectors
	const connectorsPath = path.resolve(__dirname, 'connectors');
	const connectorFiles = fs.readdirSync(connectorsPath);
	for (const connectorFile of connectorFiles) {
		const connectorName = path.basename(connectorFile, path.extname(connectorFile));
		const connectorModule = require(path.join(connectorsPath, connectorName));
		if (!dbConnectorTypes.hasOwnProperty(connectorName)) {
			exports.registerConnectorType(connectorName, connectorModule);
		}
	}

	// Validate config object
	const configType = (Array.isArray(dbConfigs)) ? 'array' : typeof dbConfigs;
	if (configType !== 'object') {
		throw new Error(`Invalid "db" configuration type "${configType}", must be an object map`);
	}

	// Setup each db connector
	for (const dbName of Object.keys(dbConfigs)) {
		const dbConfig = dbConfigs[dbName];
		const DBConnector = dbConnectorTypes[dbConfig.type];
		if (!DBConnector) {
			throw new Error(`Invalid db connector type: ${dbName} [${dbConfig.type}]`);
		}

		logger.info('Creating db connector instance:', dbName, `[${dbConfig.type}]`);
		dbConnectorCache[dbName] = new DBConnector(dbName, dbConfig);
	}
};

/**
 *
 * @returns {Promise<void>}
 */
exports.start = async () => {
	for (const dbName of Object.keys(dbConnectorCache)) {
		const dbConnector = dbConnectorCache[dbName];
		await dbConnector.start();
	}
};

/**
 *
 * @returns {Promise<void>}
 */
exports.stop = async () => {
	for (const dbName of Object.keys(dbConnectorCache)) {
		const dbConnector = dbConnectorCache[dbName];
		await dbConnector.stop();
	}
};
