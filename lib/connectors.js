'use strict';

const fs = require('fs');
const path = require('path');

const requirePeer = require('codependency').get('subsystem-dbms');
const logger = requirePeer('subsystem-logger')('db');


const defaultConnectorsPath = path.resolve(__dirname, 'connectors');
const dbConnectorTypes = {};
const dbConnectorCache = {};


/**
 *
 * @param typeName
 * @param module
 */
exports.registerConnectorType = (typeName, module) => {
	logger.info('Registering connector type:', typeName);
	if (dbConnectorTypes.hasOwnProperty(typeName)) {
		logger.info('Connector type', typeName, 'already exists, overwriting');
	}

	dbConnectorTypes[typeName] = module;
};

/**
 *
 * @param typeName
 * @param ignoreError
 * @returns {*}
 */
exports.getConnectorType = (typeName, ignoreError) => {
	if (!dbConnectorTypes.hasOwnProperty(typeName)) {
		const defaultPath = path.join(defaultConnectorsPath, typeName);
		if (fs.existsSync(defaultPath)) {
			const module = require(defaultPath);
			exports.registerConnectorType(typeName, module);
		} else {
			if (ignoreError) {
				return null;
			}

			throw new Error(`Could not resolve connector type "${typeName}"`);
		}
	}

	return dbConnectorTypes[typeName];
};

/**
 *
 * @param dbName
 * @param dbConfig
 */
exports.registerConnector = (dbName, dbConfig) => {
	if (dbConnectorCache.hasOwnProperty(dbName)) {
		throw new Error(`Connector with name "${dbName}" 'already registered`);
	}

	const DBConnector = exports.getConnectorType(dbConfig.type, true);
	if (!DBConnector) {
		throw new Error(`Invalid connector type: ${dbName} [${dbConfig.type}]`);
	}

	logger.info('Creating connector instance:', dbName, `[${dbConfig.type}]`);
	dbConnectorCache[dbName] = new DBConnector(dbName, dbConfig);
};

/**
 *
 * @param dbName
 * @returns {*}
 */
exports.getConnector = (dbName) => {
	if (!dbConnectorCache.hasOwnProperty(dbName)) {
		throw new Error(`Connector with name "${dbName}" has not been registered`);
	}

	return dbConnectorCache[dbName];
};

/**
 *
 */
exports.start = async () => {
	for (const dbName of Object.keys(dbConnectorCache)) {
		const dbConnector = dbConnectorCache[dbName];
		await dbConnector.start();
	}
};

/**
 *
 */
exports.stop = async () => {
	for (const dbName of Object.keys(dbConnectorCache)) {
		const dbConnector = dbConnectorCache[dbName];
		await dbConnector.stop();
	}
};

