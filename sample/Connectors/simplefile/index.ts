import fs from 'fs/promises';
import path from 'path';
import appRoot from 'app-root-path';
import filenamify from 'filenamify';

import loggerFactory from '@catalyststack/subsystem-logger';

import {
	DBConfig,
	CollectionKey,
	Connector
} from '../../../src';
import {
	LoggerContext
} from '@catalyststack/subsystem-logger';


// Connector magic word to identify meta files
const DBMS_SIMPLE_FILE = 'DBMS_SIMPLE_FILE';
const META_FILENAME = 'meta.json';

//
const OP_MAX_RETRIES = 20;
const OP_RETRY_DELAY_MS = 10;


//
function createNamedError(
	name: string,
	description: string
) : Error {
	const error = new Error(description);
	error.name = name;
	return error;
}


/**
 *
 */
type DBMetaData = {
	magic: string
	version: string | null
}


/**
 *
 */
export type SimpleFileConfig = {
	type: string
	warmup: boolean
	options: {
		path: string
	}
}


/**
 *
 */
export default class SimpleFileConnector extends Connector<SimpleFileConfig> {
	private _dbPath: string;
	private _logger: LoggerContext;
	private _isWarm = false;

	/**
	 *
	 */
	public constructor(
		dbName: string,
		dbConfig: DBConfig & SimpleFileConfig,
	) {
		super(dbName, dbConfig);

		const configPath = dbConfig.options.path;
		this._dbPath = path.resolve(appRoot.path, configPath);
		this._logger = loggerFactory(dbName);
	}


	/********************************
	 **    Internal Operations     **
	 ********************************/
	/**
	 * Create a DB path for the given filename.
	 */
	public dbPath(
		filename: string,
	) : string {
		const dbPath = this._dbPath;
		return path.resolve(dbPath, filename);
	}

	/**
	 * Create a DB filename for the given collection and key.
	 */
	public dbFilename(
		collection: string,
		key: CollectionKey,
	) : string {
		if (Array.isArray(key)) {
			key = filenamify(key.join('/'));
		} else if (typeof key === 'object') {
			const keyArr = [];
			for (const objKey of Object.keys(key).sort()) {
				keyArr.push(`${objKey}=${key[objKey]}`);
			}
			key = filenamify(keyArr.join('/'));
		}

		const filename = `${collection}/${key}.json`;
		return filename;
	}

	/**
	 * Check if a valid DB file exists for the given filename.
	 */
	public async dbPathExists(
		filename: string,
		{
			allowFolders = false,
		}: {
			allowFolders?: boolean,
		} = {}
	) : Promise<boolean> {
		const filepath = this.dbPath(filename);

		// Attempt to fs.stat the file
		let fileStat;
		try {
			fileStat = await fs.stat(filepath);
		} catch (error) {
			// File doesn't exist
			return false;
		}

		// Check if file descriptor is a file
		if (fileStat.isFile()) {
			return true;
		}

		// Check if file descriptor is a folder and we allow them
		if (allowFolders && fileStat.isDirectory()) {
			return true;
		}

		// Otherwise we have an invalid file
		throw createNamedError(
			'FILE_INVALID',
			`DB file path is not a file: ${filepath}`
		);
	}

	/**
	 * Returns the DB data file for the given filename.
	 */
	public async dbFileRead(
		filename: string,
		{
			optional = false
		}: {
			optional?: boolean
		} = {},
	) : Promise<unknown> {
		const filepath = this.dbPath(filename);

		// Attempt to read the DB file
		let fileRaw;
		try {
			fileRaw = await fs.readFile(filepath, {
				encoding: 'utf8'
			});
		} catch (error) {
			// Check if the read operation was optional
			if (optional) {
				return undefined;
			}

			// Otherwise throw an error
			throw createNamedError(
				'FILE_NOT_FOUND',
				`could not find DB file: ${filepath}`,
			);
		}

		// Parse the file data
		// NOTE: this should throw if there was a parse error
		return JSON.parse(fileRaw);
	}

	/**
	 * Writes a DB file for the given filename and data.
	 */
	public async dbFileWrite(
		filename: string,
		fileData: unknown,
		{
			createFolders = false,
			failOnExists = false,
			failOnNotExists = false,
		}: {
			createFolders?: boolean,
			failOnExists?: boolean,
			failOnNotExists?: boolean,
		} = {},
	) : Promise<void> {
		const filepath = this.dbPath(filename);

		// Serialize JSON data
		const fileRaw = JSON.stringify(fileData, null, '  ');

		//
		if (createFolders) {
			const directory = path.dirname(filename);
			fs.mkdir(directory, { recursive: true });
		}


		//
		let writeFlag;
		if (failOnExists) {
			writeFlag = 'wx';
		} else if (failOnNotExists) {
			writeFlag = 'r+';
		} else {
			writeFlag = 'w';
		}

		//
		await fs.writeFile(filepath, fileRaw, {
			encoding: 'utf8',
			flag: writeFlag,
		});
	}

	/**
	 * Checks if DB exists or if it needs to be created
	 */
	public async dbExists() : Promise<boolean> {
		try {
			const metaData = await this.dbFileRead(META_FILENAME) as DBMetaData;
			if (metaData.magic !== DBMS_SIMPLE_FILE) {
				return false;
			}
		} catch (error) {
			return false;
		}

		return true;
	}


	/********************************
	 **    Database Operations     **
	 ********************************/
	/**
	 *
	 */
	public async dbCreate() : Promise<void> {
		const dbPath = this.dbPath('.');

		// Make sure DB path exists
		if (await this.dbPathExists(dbPath, { allowFolders: true }) === false) {
			await fs.mkdir(dbPath, { recursive: true });
			this._logger.info('Created DB folder:', dbPath);
		}

		// Attempt to write meta file, but only if it doesn't exist
		const metaData: DBMetaData = { magic: DBMS_SIMPLE_FILE, version: null };
		const metaRaw = JSON.stringify(metaData, null, '  ');
		const dbMetaPath = this.dbPath(META_FILENAME);

		try {
			await fs.writeFile(dbMetaPath, metaRaw, {
				encoding: 'utf8',
				flag: 'wx',
			});
			this._logger.info('Created DB meta File:', dbMetaPath);
		} catch (error) {
			// Write failed, see if DB already exists
			if (await this.dbExists() === true) {
				this._logger.info('DB already exists:', this.name);
				return;
			}

			// If not, re-throw write error
			throw error;
		}
	}

	/**
	 *
	 */
	public async dbDrop() : Promise<void> {
		// Check if DB exists
		if (await this.dbExists() === false) {
			this._logger.info('DB doesn\'t exist:', this.name);
			return;
		}

		// Recursively delete DB folder
		const dbPath = this.dbPath('.');
		await fs.rmdir(dbPath, {
			recursive: true,
			maxRetries: OP_MAX_RETRIES,
			retryDelay: OP_RETRY_DELAY_MS,
		});
		this._logger.info('DB folder removed:', dbPath);
	}


	/********************************
	 **     Warm-up Operations     **
	 ********************************/
	/**
	 *
	 */
	public async start() : Promise<void> {
		if (this._isWarm) {
			return;
		}

		if (await this.dbExists() === false) {
			throw createNamedError(
				'DB_NOT_FOUND',
				'database has not been created yet',
			);
		}

		this._isWarm = true;
	}

	/**
	 *
	 */
	public async stop() : Promise<void> {
		this._isWarm = false;
	}


	/********************************
	 **    Migration Operations    **
	 ********************************/
	/**
	 *
	 */
	public async versionSet(
		version: string | null,
	) : Promise<void> {
		//
		const metaData = await this.dbFileRead(META_FILENAME) as DBMetaData;

		//
		metaData.version = version;
		await this.dbFileWrite(META_FILENAME, metaData);
	}

	/**
	 *
	 */
	public async versionGet() : Promise<string | null> {
		//
		const metaData = await this.dbFileRead(META_FILENAME) as DBMetaData;

		//
		return metaData.version;
	}

	/**
	 *
	 */
	public async collectionCreate(collectionName: string) : Promise<void> {
		if (!this._isWarm) {
			await this.start();
		}

		// Make sure collection path exists
		const collecitonPath = this.dbPath(collectionName);
		if (await this.dbPathExists(collecitonPath, { allowFolders: true }) === false) {
			await fs.mkdir(collecitonPath, { recursive: true });
			this._logger.info('Created collection folder:', collecitonPath);
		}
	}

	/**
	 *
	 */
	public async collectionDrop(collectionName: string) : Promise<void> {
		if (!this._isWarm) {
			await this.start();
		}

		// Remove collection folder if it exists
		const collecitonPath = this.dbPath(collectionName);
		if (await this.dbPathExists(collecitonPath, { allowFolders: true }) === true) {
			await fs.rmdir(collecitonPath, {
				recursive: true,
				maxRetries: OP_MAX_RETRIES,
				retryDelay: OP_RETRY_DELAY_MS,
			});
			this._logger.info('Collection folder removed:', collecitonPath);
		}
	}


	/********************************
	 **    Document Operations     **
	 ********************************/
	/**
	 * Checks if a document with key exists within the collection.
	 */
	public async exists(
		collection: string,
		key: CollectionKey,
	) : Promise<boolean> {
		if (!this._isWarm) {
			await this.start();
		}

		const filename = this.dbFilename(collection, key);
		return this.dbPathExists(filename);
	}

	/**
	 * Gets document's data for the given collection & key.
	 *
	 * If the given collection & key do not exist, and `optional` is set to
	 * `true`, `undefined` will be returned. Otherwise will throw an error.
	 */
	public async get<TData>(
		collection: string,
		key: CollectionKey,
		{
			optional = false
		}: {
			optional?: boolean
		} = {},
	) : Promise<TData> {
		if (!this._isWarm) {
			await this.start();
		}

		const filename = this.dbFilename(collection, key);
		const fileData = await this.dbFileRead(filename, { optional });
		return fileData as TData;
	}

	/**
	 * Writes a document's data for the given collection & key, REGARDLESS of
	 * whether it or not it exists
	 */
	public async set<TData>(
		collection: string,
		key: CollectionKey,
		fileData: TData,
	) : Promise<void> {
		if (!this._isWarm) {
			await this.start();
		}

		const filename = this.dbFilename(collection, key);
		await this.dbFileWrite(filename, fileData);
	}

	/**
	 * Writes a document's data for the given collection & key, but only if it
	 * DOES NOT exist. Otherwise will throw an error.
	 */
	public async create<TData>(
		collection: string,
		key: CollectionKey,
		fileData: TData,
	) : Promise<void> {
		if (!this._isWarm) {
			await this.start();
		}

		const filename = this.dbFilename(collection, key);
		await this.dbFileWrite(filename, fileData, { failOnExists: true });
	}

	/**
	 * Writes a document's data for the given collection & key, but only if it
	 * ALREADY exists. Otherwise will throw an error.
	 */
	public async update<TData>(
		collection: string,
		key: CollectionKey,
		fileData: TData,
	) : Promise<void> {
		if (!this._isWarm) {
			await this.start();
		}

		const filename = this.dbFilename(collection, key);
		await this.dbFileWrite(filename, fileData, { failOnNotExists: true });
	}

	/**
	 * Deletes a document for the given collection & key.
	 *
	 * If the given collection & key do not exist, and `optional` is set to
	 * `true`, no error will be thrown. Otherwise will throw an error.
	 */
	public async delete(
		collection: string,
		key: CollectionKey,
		{
			optional = false
		}: {
			optional?: boolean
		} = {},
	) : Promise<void> {
		if (!this._isWarm) {
			await this.start();
		}

		const filename = this.dbFilename(collection, key);
		const dbPath = this.dbPath(filename);

		// Delete the document file
		await fs.rm(dbPath, {
			force: optional,
			maxRetries: OP_MAX_RETRIES,
			retryDelay: OP_RETRY_DELAY_MS,
		});
	}
}
