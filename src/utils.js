import fs from 'node:fs';
import { promisify } from 'node:util';
import { spawn as spwn, exec } from 'node:child_process';
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
		logger.warn(`error checking for file existance: ${err.message}`);
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

export const execAsync = promisify(exec);

/*
 * Converts a timezone offset in minutes to a string format like "+02:00"
 *
 * @param {number} offset
 * @returns {string} The formatted timezone offset
 */
export function convertCommitTimezoneOffset(offset) {
	const sign = offset >= 0 ? '+' : '-';
	const absOffset = Math.abs(offset);
	const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
	const minutes = String(absOffset % 60).padStart(2, '0');
	return `${sign}${hours}:${minutes}`;
}

/**
 * Ensures the server has the variables needed to run before execution
 *
 * @param {string} key
 *
 * @returns key
 **/
export function envPresentOrThrow(key) {
	if (!(key in process.env)) {
		throw Error(`environment variable missing: ${key}`);
	}

	return process.env[key];
}
