import { DBConfig, CollectionKey } from './index';


export interface IConnectorCtr {
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	new(dbName: string, dbConfig: DBConfig & any): IConnector
}

export interface IConnector {
	name: string
	config: DBConfig

	dbCreate() : Promise<void>
	dbDrop() : Promise<void>

	start() : Promise<void>
	stop() : Promise<void>

	versionSet(version: string | null) : Promise<void>
	versionGet() : Promise<string | null>

	exists(collection: string, key: CollectionKey) : Promise<boolean>;
	get<TData>(collection: string, key: CollectionKey, options?: { optional?: boolean }) : Promise<TData>;
	set<TData>(collection: string, key: CollectionKey, data: TData) : Promise<void>;
	create<TData>(collection: string, key: CollectionKey, data: TData) : Promise<void>;
	update<TData>(collection: string, key: CollectionKey, data: TData) : Promise<void>;
	delete(collection: string, key: CollectionKey, options?: { optional?: boolean }) : Promise<void>;
}

export abstract class Connector<TConfig> implements IConnector {
	public name: string;
	public config: DBConfig & TConfig;

	public constructor(dbName: string, dbConfig: DBConfig & TConfig) {
		this.name = dbName;
		this.config = dbConfig;
	}

	abstract dbCreate() : Promise<void>;
	abstract dbDrop() : Promise<void>;

	abstract start() : Promise<void>;
	abstract stop() : Promise<void>;

	abstract versionSet(version: string | null) : Promise<void>;
	abstract versionGet() : Promise<string | null>;

	abstract exists(collection: string, key: CollectionKey, options?: { optional?: boolean }) : Promise<boolean>;
	abstract get<TData>(collection: string, key: CollectionKey) : Promise<TData>;
	abstract set<TData>(collection: string, key: CollectionKey, data: TData) : Promise<void>;
	abstract create<TData>(collection: string, key: CollectionKey, data: TData) : Promise<void>;
	abstract update<TData>(collection: string, key: CollectionKey, data: TData) : Promise<void>;
	abstract delete(collection: string, key: CollectionKey, options?: { optional?: boolean }) : Promise<void>;
}
