'use strict';

const mysql = require('mysql2');
const ConnectionConfig = require('mysql2/lib/connection_config');

const logger = require('subsystem-logger')('mysql');


class MySQLConnector {
	constructor(name, config) {
		this.name = name;
		this.config = config;

		// Construct connection pool configuration object
		const options = {};
		if (config.options) {
			const optionsConfigType = (Array.isArray(config.options)) ? 'array' : typeof config.options;
			if (optionsConfigType !== 'object') {
				throw new Error(`Invalid "db.options" type "${optionsConfigType}", must be an object map`);
			}
			Object.assign(options, config.options);
		}
		if (config.url) {
			const urlOptions = new ConnectionConfig(config.url.toString());
			Object.assign(options, urlOptions);
		}

		// Create connection pool
		this.pool = mysql.createPool(options);
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

	async exists(table, key) {

	}

	async get(table, key) {

	}

	async set(table, key, data) {

	}

	async add(table, key, data) {

	}

	async replace(table, key, data) {

	}

	async delete(table, key) {

	}
}

module.exports = MySQLConnector;
