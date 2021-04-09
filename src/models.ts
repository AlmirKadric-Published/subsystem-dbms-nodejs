import path from 'path';
import glob from 'tiny-glob';
import appRoot from 'app-root-path';

import * as dbms from './index';

import loggerFactory from '@catalyststack/subsystem-logger';
const logger = loggerFactory('dbms');

import {
	IConnector,
	IModel,
	IModelCtr,
	IModelCtrCollection,
} from './types';


//
const modelCache: IModelCtrCollection = {};


/**
 *
 */
export async function registerModelFolder(
	folderGlobPath: string,
) : Promise<void> {
	const modelFiles = await glob(folderGlobPath, { cwd: appRoot.path });

	for (const modelFile of modelFiles) {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const ModelModule = require(
			/* webpackIgnore: true */
			path.resolve(appRoot.path, modelFile)
		);

		const ModelClass = ModelModule.default;
		registerModel(ModelClass.name, ModelClass);
	}
}

/**
 *
 */
export function registerModel(
	modelName: string,
	ModelClass: IModelCtr,
) : void {
	if (Object.prototype.hasOwnProperty.call(modelCache, modelName)) {
		throw new Error(`A model with the name "${modelName}" has already been registered`);
	}

	logger.info('Registering model:', modelName);
	modelCache[modelName] = ModelClass;
}

/**
 *
 */
export function getModelClass(
	model: string | IModelCtr,
) : IModelCtr {
	// Check if model is a model name string
	if (typeof model === 'string') {
		// Check if model name has been registered
		if (!Object.prototype.hasOwnProperty.call(modelCache, model)) {
			throw new Error(`Model "${model}" has not been registered`);
		}

		// Retrieve model class constructor by ID and return an instance of it
		return modelCache[model];
	} else {
		// Otherwise treat model as a ModelClass
		return model;
	}
}

/**
 *
 */
export function getModel(
	model: string | IModelCtr,
) : IModel {
	const ModelClass = getModelClass(model);
	const dbName = ModelClass.database;
	const connector = dbms.getConnector(dbName);
	const modelInstance = new ModelClass(connector);

	return modelInstance;
}

/**
 *
 */
export function getConnector(
	model: string | IModelCtr,
) : IConnector {
	const ModelClass = getModelClass(model);
	const dbName = ModelClass.database;
	const client = dbms.getConnector(dbName);

	return client;
}
