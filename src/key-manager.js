import path from 'node:path';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import { GitHubApi } from "./github-api.js";
import { fileExists, spawn } from './utils.js';
import { logger } from './logger.js';

export class KeyManager {
	/**
	* @type {GitHubApi}
	* @access private
	*/
	#api;

	/**
	* @type {string}
	* @access private
	*/
	#storagePath;

	/**
	 * @param {string} storagePath
	 */
	constructor(storagePath) {
		this.#storagePath = storagePath;
	}

	/**
	 * @param {GitHubApi} api
	 */
	setApi(api) {
		this.#api = api;
	}

	/**
	* @param {string} organization
	* @param {string} repository
	*
	* @returns string
	*/
	getKeyFileName(organization, repository) {
		return `codepulse-${organization}-${repository}`;
	}

	/**
	 * @param {string} organization
	 * @param {string} repository
	 *
	 * @returns Promise<string>
	 */
	async #createKey(organization, repository) {
		const keyFilePath = path.join(this.#storagePath, this.getKeyFileName(organization, repository));
		const code = await spawn('ssh-keygen', ['-t', 'ed25519', '-f', keyFilePath, '-C', 'codepulse@nuclea.solutions', '-N', '']);
		assert(code === 0, `could not generate ssh key with ed25519`);

		const publicKeyPath = `${path}.pub`;
		const exists = await fileExists(publicKeyPath);
		assert(exists === true, 'public key was not found');

		const publicKeyContents = await fs.readFile(publicKeyPath, 'utf-8');
		const response = await this.#api.createDeployKey(organization, repository, publicKeyContents);
		assert(response.status === 201, "error creating key in github");

		return keyFilePath;
	}

	/**
	 * Returns the path to the ssk-key to use for interacting with the repository
	 * such as for cloning, fetching, making commits, etc.
	 *
	 * @param {string} organization
	 * @param {string} repository
	 *
	 * @returns Promise<string>
	 */
	async findOrCreate(organization, repository) {
		assert(this.#api, "use setApi before calling findOrCreate or any other method");
		const keyFileName = this.getKeyFileName(organization, repository);
		const keys = await this.#api.fetchDeployKeys(organization, repository);
		const index = keys.findIndex(k => k.title === "codepulse@nuclea.solutions");

		if (index === -1) {
			return this.#createKey(organization, repository);
		}

		const keyFilePath = path.join(this.#storagePath, keyFileName);
		const exists = await fileExists(keyFilePath);
		if (exists) {
			return keyFilePath;
		}

		// key in github exists but no in local file system
		const key = keys[index];
		logger.warn(`key-manager: deploy key found in github but no in file system, deleting ${key.id}`);
		await this.#api.deleteDeployKey(organization, repository, key.id);
		return this.#createKey(organization, repository);
	}

}
