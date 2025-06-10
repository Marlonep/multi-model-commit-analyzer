import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Octokit } from 'octokit';
import { logger } from './logger.js';
import { GitHubApi } from './github-api.js';
import { wm } from './loaders.js';
import { RepositoryScanner } from './repository-scanner.js';
import { KeyManager } from './key-manager.js';
import { SSH_STORAGE_PATH } from './env.js';

const ReferenceDate = new Date(2025, 5, 1, 0, 0, 0);

export class UploadKeyService {
	/**
	* @param {object} opts
	* @param {string} opts.url
	* @param {string} opts.key
	*/
	async initialize(opts) {
		const api = new GitHubApi(new Octokit({ auth: opts.key }), logger);
		const orgs = await api.fetchOrgs();
		for (const org of orgs) {
			// setup webhook
			wm.setApi(api);
			const km = new KeyManager(SSH_STORAGE_PATH);
			km.setApi(api);
			const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `code-${org.login}`));
			logger.info(`tmpDir: ${tmpDir}`);

			await wm.getOrCreate(org.login, opts.url);
			const repos = await api.fetch(org.login, ReferenceDate);
			repos.reverse();
			for (const repo of repos) {
				const scanner = new RepositoryScanner(org.login, repo.name, api);
				logger.info(`getting ssh key for: ${org.login}/${repo.name}`);
				const keyPath = await km.findOrCreate(org.login, repo.name);

				// clone repo
				logger.info(`cloning: ${org.login}/${repo.name}`);
				const repoPath = await scanner.clone({
					sshKeyPath: keyPath,
					sshUrl: repo.ssh_url,
					tmpDir: tmpDir,
				});

				logger.info(`scanning: ${org.login}/${repo.name}`);
				const commits = await scanner.scan({
					referenceDate: ReferenceDate,
					path: repoPath,
					defaultBranch: repo.default_branch,
					sshKeyPath: keyPath,
				});
				break;
			}
		}
	}

	/**
	* @param {object} opts
	* @param {string} opts.key
	*/
	async getInfo(opts) {
		const data = { orgs: [] }
		const api = new GitHubApi(new Octokit({ auth: opts.key }), logger);
		const orgs = await api.fetchOrgs();
		for (const org of orgs) {
			const repos = await api.fetch(org.login, null);

			data.orgs.push({
				id: org.id,
				name: org.login,
				repositories: repos.map(repo => ({
					id: repo.id,
					full_name: repo.full_name,
					description: repo.description || 'No description available',
					name: repo.name,
					private: repo.private
				})),
			});
		}

		return data;
	}
}
