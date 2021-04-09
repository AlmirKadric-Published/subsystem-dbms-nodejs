import loggerFactory from '@catalyststack/subsystem-logger';
const logger = loggerFactory('dbms');

import {
	DBConfig,
	IConnector,
	IConnectorCtr,
	IConnectorCtrCollection,
	ConnectorCollection,
} from './types';


//
const connectorTypes: IConnectorCtrCollection = {};
const connectorCache: ConnectorCollection = {};


/**
 *
 * @param typeName
 * @param ConnectorClass
 */
export function registerConnectorType(
	connectorName: string,
	ConnectorClass: IConnectorCtr,
) : void {
	logger.info('Registering connector type:', connectorName);
	if (Object.prototype.hasOwnProperty.call(connectorTypes, connectorName)) {
		logger.info('Connector type', connectorName, 'already exists, overwriting');
	}

	connectorTypes[connectorName] = ConnectorClass;
}

/**
 *
 * @param typeName
 * @param ignoreError
 * @returns {*}
 */
export function getConnectorType(
	connectorName: string,
	ignoreError: boolean,
) : IConnectorCtr | undefined {
	if (!Object.prototype.hasOwnProperty.call(connectorTypes, connectorName)) {
		if (ignoreError) {
			return undefined;
		}

		throw new Error(`Could not resolve connector type "${connectorName}"`);
	}

	return connectorTypes[connectorName];
}

/**
 *
 * @param dbName
 * @param dbConfig
 */
export function registerConnector(
	dbName: string,
	dbConfig: DBConfig,
) : void {
	if (Object.prototype.hasOwnProperty.call(connectorCache, dbName)) {
		throw new Error(`Connector with name "${dbName}" 'already registered`);
	}

	const ConnectorClass = getConnectorType(dbConfig.type, true);
	if (!ConnectorClass) {
		throw new Error(`Invalid connector type: ${dbName} [${dbConfig.type}]`);
	}

	logger.info('Creating connector instance:', dbName, `[${dbConfig.type}]`);
	connectorCache[dbName] = new ConnectorClass(dbName, dbConfig);
}

/**
 *
 * @param dbName
 * @returns {*}
 */
export function getConnector(
	dbName: string,
) : IConnector {
	if (!Object.prototype.hasOwnProperty.call(connectorCache, dbName)) {
		throw new Error(`Connector with name "${dbName}" has not been registered`);
	}

	return connectorCache[dbName];
}

/**
 *
 */
export async function start() : Promise<void> {
	for (const dbName of Object.keys(connectorCache)) {
		const connector = connectorCache[dbName];
		await connector.start();
	}
}

/**
 *
 */
export async function stop() : Promise<void> {
	for (const dbName of Object.keys(connectorCache)) {
		const connector = connectorCache[dbName];
		await connector.stop();
	}
}
