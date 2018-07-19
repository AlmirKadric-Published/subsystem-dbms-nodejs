'use strict';

const requirePeer = require('codependency').get('subsystem-dbms');
const logger = requirePeer('subsystem-logger')('dbms');

const dbms = require('.');


const modelCache = {};


/**
 *
 * @param name
 * @param ModelModule
 */
exports.register = (name, ModelModule) => {
	if (modelCache.hasOwnProperty(name)) {
		throw new Error(`A model with the name "${name}" has already been registered`);
	}

	logger.info('Registering model:', name);
	modelCache[name] = ModelModule;
};

/**
 *
 * @param name
 */
exports.get = (name) => {
	if (!modelCache.hasOwnProperty(name)) {
		throw new Error(`Model "${name}" has not been registered`);
	}

	const ModelModule = modelCache[name];
	const dbName = ModelModule.database;
	const client = dbms.getConnector(dbName);

	return new ModelModule(client);
};
