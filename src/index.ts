import fs from 'fs/promises';
import path from 'path';
import glob from 'tiny-glob';
import appRoot from 'app-root-path';

import * as connectors from './connectors';

import { DBMSConfig } from './types';


//
let dbConfigs;


/**
 *
 */
export async function setup(
	config: DBMSConfig
) : Promise<void> {
	// Cache the config for later user
	dbConfigs = config || {};

	// Validate config object
	const configType = (Array.isArray(dbConfigs)) ? 'array' : typeof dbConfigs;
	if (configType !== 'object') {
		throw new Error(`Invalid "dbms" configuration type "${configType}", must be an object map`);
	}

	// Register internal sample `simplefile` connector
	const SimpleFileModule = await import('../sample/Connectors/simplefile');
	connectors.registerConnectorType('simplefile', SimpleFileModule.default);

	// Try and find and register any installed official connectors
	const modulesPath = path.resolve(appRoot.path, 'node_modules/@catalyststack');
	const modulesPathExist = await fs.stat(modulesPath)
		.then((stat) => stat.isDirectory())
		.catch(() => false);

	if (modulesPathExist) {
		const modulePaths = await glob('./node_modules/@catalyststack/subsystem-dbms-*', { cwd: appRoot.path });
		for (const modulePath of modulePaths) {
			const moduleMatch = path.basename(modulePath).toLowerCase().match(/^subsystem-dbms-(.*)/);
			if (!moduleMatch) {
				continue;
			}

			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const ConnectorModule = require(
				/* webpackIgnore: true */
				modulePath
			);

			const connectorName = moduleMatch[1];
			connectors.registerConnectorType(connectorName, ConnectorModule.default);
		}
	}

	// Setup each dbms connector
	for (const dbName of Object.keys(dbConfigs)) {
		connectors.registerConnector(dbName, dbConfigs[dbName]);
	}
}

/**
 *
 */
export async function start() : Promise<void> {
	await connectors.start();
}

/**
 *
 */
export async function stop() : Promise<void> {
	await connectors.stop();
}


//
export type {
	DBConfig, DBMSConfig,
	CollectionKey,
	IConnector, IModel
} from './types';
export {
	Connector, Model
} from './types';

//
export {
	registerConnectorType,
	registerConnector,
	getConnector,
} from './connectors';

//
export {
	registerMigrateFolder,
	registerMigrate,
	dbCreate,
	dbMigrate,
	dbDrop,
	create,
	migrate,
	drop,
} from './migrate';

//
export {
	registerModelFolder,
	registerModel,
	getModel
} from './models';

//
import SimpleFileConnector from '../sample/Connectors/simplefile';
export { SimpleFileConnector };
