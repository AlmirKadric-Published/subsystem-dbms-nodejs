'use strict';

module.exports = {
	// Input
	tsconfig: './src/tsconfig.json',
	entryPoints: './src/index.ts',

	// Output
	name: 'subsystem-dbms',
	out: './docs',
	includeVersion: true,
	disableSources: true,

	// Options
	// theme: '',
	// highlightTheme: '',
	excludePrivate: true,
	excludeProtected: true,
};
