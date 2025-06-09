import { Octokit } from 'octokit';
import { logger } from './logger.js';
import { GitHubApi } from './github-api.js';
import { wm } from './loaders.js';

export class UploadKeyService {
	/**
	* @param {object} opts
	* @param {string} opts.url
	* @param {string} opts.key
	*/
	async initialize(opts) {
		const referenceDate = new Date(2025, 5, 1, 0, 0, 0);
		const api = new GitHubApi(new Octokit({ auth: opts.key }), logger);
		const orgs = await api.fetchOrgs();
		for (const org of orgs) {
			// setup webhook
			wm.setApi(api);

			await wm.getOrCreate(org.login, opts.url);

			// const repos = await api.fetch(org.login, referenceDate);
			// console.log(repos);
		}
	}
}
