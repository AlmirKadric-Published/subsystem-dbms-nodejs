'use strict';

const requirePeer = require('codependency').get('subsystem-db');
const mysql = requirePeer('mysql2');
const ConnectionConfig = requirePeer('mysql2/lib/connection_config');

const logger = requirePeer('subsystem-logger')('mysql');


class MySQLConnector {
	constructor(name, config) {
		this.name = name;
		this.config = config;

		// Construct connection pool configuration object
		const options = {};
		if (config.url) {
			const urlOptions = new ConnectionConfig(config.url.toString());
			Object.assign(options, urlOptions);
		}
		if (config.options) {
			const optionsConfigType = (Array.isArray(config.options)) ? 'array' : typeof config.options;
			if (optionsConfigType !== 'object') {
				throw new Error(`Invalid "db.options" type "${optionsConfigType}", must be an object map`);
			}
			Object.assign(options, config.options);
		}

		// Create connection pool
		// TODO: create client, pool or poolcluster depending on config
		this.pool = mysql.createPool(options);
	}

	async execute(query, params) {
		params = params || [];

		//
		const config = this.pool.config.connectionConfig;
		const newOptions = Object.assign({}, config, { database: undefined });
		const connection = mysql.createConnection(newOptions);

		//
		logger.verbose('Executing query:', query, params);
		await new Promise((resolve, reject) => {
			connection.query(query, params, (error) => {
				if (error) {
					return reject(error);
				}

				return resolve();
			});
		});

		//
		await new Promise((resolve, reject) => {
			connection.end((error) => {
				if (error) {
					return reject(error);
				}

				return resolve();
			});
		});
	}

	async dbCreate() {
		const config = this.pool.config.connectionConfig;
		const dbName = config.database;

		logger.info('Creating database:', dbName);

		const escapedDBName = mysql.escapeId(dbName);
		const query = `CREATE DATABASE IF NOT EXISTS ${escapedDBName}`;
		await this.execute(query);

		await this.tableCreate('_versions', [
			{ name: 'id', type: 'INT NOT NULL AUTO_INCREMENT', isPrimaryKey: true },
			{ name: 'version', type: 'VARCHAR(100) NOT NULL' },
			{ name: 'date', type: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP' }
		], true);
	}

	async dbDrop() {
		const config = this.pool.config.connectionConfig;
		const dbName = config.database;

		logger.info('Dropping database:', dbName);

		const escapedDBName = mysql.escapeId(dbName);
		const query = `DROP DATABASE IF EXISTS ${escapedDBName}`;
		await this.execute(query);
	}

	async start() {
		// Check if we should war up some connections to ensure
		// we can connect during the start process
		if (this.config.warmup) {
			let warmupCount = this.config.warmup;
			if (typeof warmupCount === 'boolean') {
				warmupCount = this.pool.config.connectionLimit;
			}

			logger.info('Warming up connections for:', this.name, `(${warmupCount} connections)`);

			// Attempt to acquire the warmup connections
			const connections = [];
			for (let i = 0; i < warmupCount; i += 1) {
				const connection = await new Promise((resolve, reject) => {
					this.pool.getConnection((error, connection) => {
						if (error) {
							return reject(error);
						}

						return resolve(connection);
					});
				});

				connections[i] = connection;
			}

			// Now release acquired connection back to the pool
			for (const connection of connections) {
				this.pool.releaseConnection(connection);
			}
		}

		const connectionConfig = this.pool.config.connectionConfig;
		logger.notice('Connector setup:', this.name, `${connectionConfig.host}:${connectionConfig.port}`);
	}

	async stop() {
		// Gracefully shut down all connections
		await new Promise((resolve, reject) => {
			this.pool.end((error) => {
				if (error) {
					return reject(error);
				}

				return resolve();
			});
		});

		logger.notice('All connections closed');
	}

	async query(query, params) {
		params = params || [];
		if (Array.isArray(params)) {
			for (let i = 0; i < params.length; i += 1) {
				const param = params[i];
				if (typeof param === 'object') {
					params[i] = JSON.stringify(param);
				}
			}
		} else if (typeof params === 'object') {
			for (const key of Object.keys(params)) {
				const param = params[key];
				if (typeof param === 'object') {
					params[key] = JSON.stringify(param);
				}
			}
		}

		logger.verbose('Executing query:', query, params);
		return await new Promise((resolve, reject) => {
			this.pool.query(query, params, (error, results, fields) => {
				if (error) {
					return reject(error);
				}

				return resolve({ results, fields });
			});
		});
	}

	async versionSet(version) {
		const query = `INSERT INTO _versions SET ?`;
		await this.query(query, { version });
	}

	async versionGet() {
		const query = `SELECT version FROM _versions ORDER BY id DESC LIMIT 1`;
		const { results } = await this.query(query);
		if (results.length === 0) {
			return null;
		}

		if (results.length > 1) {
			logger.warning('"versionGet" query returned more than 1 result');
		}

		return results[0].version;
	}

	async tableCreate(table, columns, ignoreExisting) {
		//
		const tableDef = [];
		const primaryKeys = [];
		for (const column of columns) {
			tableDef.push(`${column.name} ${column.type}`);

			if (column.isPrimaryKey) {
				primaryKeys.push(column.name);
			}
		}

		if (primaryKeys.length > 0) {
			const primaryKeysStr = primaryKeys.join(', ');
			tableDef.push(`CONSTRAINT PK_index PRIMARY KEY (${primaryKeysStr})`);
		}

		//
		const escapedTable = this.pool.escapeId(table);
		const tableDefStr = tableDef.join(', ');
		const ignoreExistingStr = (ignoreExisting) ? 'IF NOT EXISTS' : '';
		const queryStr = `CREATE TABLE ${ignoreExistingStr} ${escapedTable} (${tableDefStr}) CHARACTER SET=utf8`;

		//
		await this.query(queryStr);
	}

	async tableDrop(table) {
		//
		const escapedTable = this.pool.escapeId(table);
		const queryStr = `DROP TABLE ${escapedTable}`;

		//
		await this.query(queryStr);
	}

	async exists(table, index) {
		//
		const where = [];
		const params = [];
		for (const key of Object.keys(index)) {
			const escapedKey = this.pool.escapeId(key);
			where.push(`${escapedKey} = ?`);
			params.push(index[key]);
		}

		//
		const escapedTable = this.pool.escapeId(table);
		const whereStr = where.join(' AND ');
		const queryStr = `SELECT COUNT(*) AS count FROM ${escapedTable} WHERE ${whereStr}`;

		//
		const { results } = await this.query(queryStr, params);

		if (results.length === 0) {
			throw new Error(`"exists" query returned no results`);
		}

		if (results.length > 1) {
			logger.warning('"exists" query returned more than 1 result');
		}

		return results[0].count > 0;
	}

	async get(table, index) {
		//
		const where = [];
		const params = [];
		for (const key of Object.keys(index)) {
			const escapedKey = this.pool.escapeId(key);
			where.push(`${escapedKey} = ?`);
			params.push(index[key]);
		}

		//
		const escapedTable = this.pool.escapeId(table);
		const whereStr = where.join(' AND ');
		const queryStr = `SELECT * FROM ${escapedTable} WHERE ${whereStr}`;

		//
		const { results } = await this.query(queryStr, params);

		if (results.length > 1) {
			logger.warning('"get" returned more than 1 result');
		}

		return results[0];
	}

	async set(table, index, data) {
		//
		const finalData = Object.assign({}, data, index);

		//
		const escapedTable = this.pool.escapeId(table);
		const queryStr = `INSERT INTO ${escapedTable} ON DUPLICATE KEY UPDATE SET ?`;

		//
		await this.query(queryStr, finalData);
	}

	async add(table, index, data) {
		//
		const finalData = Object.assign({}, data, index);

		//
		const escapedTable = this.pool.escapeId(table);
		const queryStr = `INSERT INTO ${escapedTable} SET ?`;

		//
		await this.query(queryStr, finalData);
	}

	async replace(table, index, data) {
		//
		const finalData = Object.assign({}, data, index);

		//
		const escapedTable = this.pool.escapeId(table);
		const queryStr = `UPDATE ${escapedTable} SET ?`;

		//
		await this.query(queryStr, finalData);
	}

	async list(table) {
		//
		const escapedTable = this.pool.escapeId(table);
		const queryStr = `SELECT * FROM ${escapedTable}`;

		//
		const { results } = await this.query(queryStr);

		return results;
	}

	async delete(table, index) {
		//
		const where = [];
		const params = [];
		for (const key of Object.keys(index)) {
			const escapedKey = this.pool.escapeId(key);
			where.push(`${escapedKey} = ?`);
			params.push(index[key]);
		}

		//
		const escapedTable = this.pool.escapeId(table);
		const whereStr = where.join(' AND ');
		const queryStr = `DELETE FROM ${escapedTable} WHERE ${whereStr}`;

		//
		await this.query(queryStr, params);
	}
}

module.exports = MySQLConnector;
