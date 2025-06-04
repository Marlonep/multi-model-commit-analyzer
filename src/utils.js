import fs from 'node:fs';
import { spawn as spwn } from 'node:child_process';
import { logger } from './logger.js';

/**
 * @param {string} path
*
* @returns bool
*/
export async function fileExists(path) {
	try {
		await fs.promises.stat(path);
		return true;
	} catch (err) {
		logger.error(`error checking for file existance: ${err.message}`);
		return false;
	}
}

/**
 * @param {string} command
 * @param {Array<string>} args
 * @param {Object} options
 */
export async function spawn(command, args, options = {}) {
	return new Promise((resolve) => {
		const process = spwn(command, args, options);

		process.on('close', (code) => {
			resolve(code);
		});
	});
}
