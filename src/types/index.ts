import { Connector } from './Connector';
import { Model } from './Model';

import { IConnectorCtr, IConnector } from './Connector';
import { IModelCtr, IModel } from './Model';



export type DBConfig = {
	type: string
}

export type DBMSConfig = {
	[dbName: string]: DBConfig
}


export type CollectionKeyPrimitive = string | number

export type CollectionKeyObject = {
	[s: string]: CollectionKeyPrimitive
}

export type CollectKeyArray = CollectionKeyPrimitive[]

export type CollectionKey = CollectionKeyPrimitive | CollectionKeyObject | CollectKeyArray;


export type { IConnectorCtr, IConnector };

export { Connector };

export type IConnectorCtrCollection = {
	[typeName: string]: IConnectorCtr
}

export type ConnectorCollection = {
	[typeName: string]: IConnector
}


export type { IModelCtr, IModel };

export { Model };

export type IModelCtrCollection = {
	[modelName: string]: IModelCtr
}


export enum MigrateDirection {
	up = 'up',
	down = 'down',
}

export type MigrateFile = {
	dbName: string,
	version: string,
	MigrateModule: IMigrate
	meta: unknown
}

export type MigrateVersionFiles = {
	[version: string]: MigrateFile[]
}

export type MigrateDBVersions = {
	[dbName: string]: MigrateVersionFiles
}

export interface IMigrate {
	up: (connector: IConnector) => void
	down: (connector: IConnector) => void
}
