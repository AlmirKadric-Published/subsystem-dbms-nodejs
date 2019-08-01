'use strict';

const requirePeer = require('codependency').get('@catalyststack/subsystem-dbms');
const logger = requirePeer('@catalyststack/subsystem-logger')('dbms');

const fs = require('fs');
const path = require('path');


const sampleConnectorsPath = path.resolve(__dirname, '../sample');

const dbmsPackageJSON = require(path.resolve(__dirname, '..', 'package.json'));
const dbmsPeerDeps = dbmsPackageJSON.optionalPeerDependencies;

const connectorTypes = {};
const connectorCache = {};


/**
 *
 * @param typeName
 * @param module
 */
exports.registerConnectorType = (typeName, module) => {
	logger.info('Registering connector type:', typeName);
	if (connectorTypes.hasOwnProperty(typeName)) {
		logger.info('Connector type', typeName, 'already exists, overwriting');
	}

	connectorTypes[typeName] = module;
};

/**
 *
 * @param typeName
 * @param ignoreError
 * @returns {*}
 */
exports.getConnectorType = (typeName, ignoreError) => {
	if (!connectorTypes.hasOwnProperty(typeName)) {
		const samplePath = path.join(sampleConnectorsPath, typeName);
		const peerName = `@catalyststack/subsystem-dbms-${typeName}`;

		if (fs.existsSync(samplePath)) {
			const module = require(samplePath);
			exports.registerConnectorType(typeName, module);
		} else if (Object.keys(dbmsPeerDeps).find((item) => item.toLowerCase() === peerName.toLowerCase())) {
			const module = requirePeer(peerName);
			exports.registerConnectorType(typeName, module);
		} else {
			if (ignoreError) {
				return null;
			}

			throw new Error(`Could not resolve connector type "${typeName}"`);
		}
	}

	return connectorTypes[typeName];
};

/**
 *
 * @param dbName
 * @param dbConfig
 */
exports.registerConnector = (dbName, dbConfig) => {
	if (connectorCache.hasOwnProperty(dbName)) {
		throw new Error(`Connector with name "${dbName}" 'already registered`);
	}

	const Connector = exports.getConnectorType(dbConfig.type, true);
	if (!Connector) {
		throw new Error(`Invalid connector type: ${dbName} [${dbConfig.type}]`);
	}

	logger.info('Creating connector instance:', dbName, `[${dbConfig.type}]`);
	connectorCache[dbName] = new Connector(dbName, dbConfig);
};

/**
 *
 * @param dbName
 * @returns {*}
 */
exports.getConnector = (dbName) => {
	if (!connectorCache.hasOwnProperty(dbName)) {
		throw new Error(`Connector with name "${dbName}" has not been registered`);
	}

	return connectorCache[dbName];
};

/**
 *
 */
exports.start = async () => {
	for (const dbName of Object.keys(connectorCache)) {
		const connector = connectorCache[dbName];
		await connector.start();
	}
};

/**
 *
 */
exports.stop = async () => {
	for (const dbName of Object.keys(connectorCache)) {
		const connector = connectorCache[dbName];
		await connector.stop();
	}
};

