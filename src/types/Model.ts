import { CollectionKey, IConnector } from './index';

export interface IModelCtr {
	database: string;
	collection: string;

	new(connector: IConnector): IModel
}

export interface IModel {
	connector: IConnector

	validate(data: unknown) : Promise<boolean>;

	exists(key: CollectionKey) : Promise<boolean>;
	get(key: CollectionKey, options?: { optional?: boolean }) : Promise<unknown>;
	set(key: CollectionKey, data: unknown) : Promise<void>;
	create(key: CollectionKey, data: unknown) : Promise<void>;
	update(key: CollectionKey, data: unknown) : Promise<void>;
	delete(key: CollectionKey, options?: { optional?: boolean }) : Promise<void>;
}

export abstract class Model<TData> implements IModel {
	public static database: string;
	public static collection: string;
	public connector: IConnector

	public constructor(connector: IConnector) {
		this.connector = connector;
	}

	public async validate(/* data: TData */) : Promise<boolean> {
		// TODO: implement this
		return true;
	}

	public async exists(key: CollectionKey) : Promise<boolean> {
		const ModelClass = this.constructor as IModelCtr;
		return await this.connector.exists(ModelClass.collection, key);
	}

	public async get(key: CollectionKey, options?: { optional?: boolean }) : Promise<TData> {
		const ModelClass = this.constructor as IModelCtr;
		return await this.connector.get(ModelClass.collection, key, options);
	}

	public async set(key: CollectionKey, data: TData) : Promise<void> {
		const ModelClass = this.constructor as IModelCtr;
		return await this.connector.set(ModelClass.collection, key, data);
	}

	public async create(key: CollectionKey, data: TData) : Promise<void> {
		const ModelClass = this.constructor as IModelCtr;
		return await this.connector.create(ModelClass.collection, key, data);
	}

	public async update(key: CollectionKey, data: TData) : Promise<void> {
		const ModelClass = this.constructor as IModelCtr;
		return await this.connector.update(ModelClass.collection, key, data);
	}

	public async delete(key: CollectionKey, options?: { optional?: boolean }) : Promise<void> {
		const ModelClass = this.constructor as IModelCtr;
		return await this.connector.delete(ModelClass.collection, key, options);
	}
}
