import { Logger } from 'winston';
import { Octokit } from 'octokit';

export class GitHubApi {
	// https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-organization-repositories
	static PerPage = 100;

	/**
	* @type {Octokit}
	* @access private
	*/
	#octokit;


	/**
	* @type {Logger}
	* @access private
	*/
	#logger;

	/**
	* @param {Octokit} octokit
	* @param {Logger} logger
	*/
	constructor(octokit, logger) {
		this.#octokit = octokit;
		this.#logger = logger;
	}

	async fetchOrgs() {
		const response = await this.#octokit.request('GET /user/orgs', {
			headers: {
				'X-GitHub-Api-Version': '2022-11-28'
			}
		})

		return response.data;
	}

	/**
	* @param {string} organization
	* @param {Date} fromDate
	* @returns {Promise<Array<{ ssh_url: string; name: string; updated_at: string; default_branch: string; }>>}
	*/
	async fetch(organization, fromDate) {
		let page = 1;

		const repos = [];

		for (; ;) {
			const response = await this.#octokit.request('GET /orgs/{org}/repos', {
				org: organization,
				type: 'all',
				per_page: GitHubApi.PerPage,
				page: page,
				sort: 'pushed',
				direction: 'desc',
			});


			const afterDate = response.data.filter(r => {
				return new Date(r.pushed_at) >= fromDate;
			});

			repos.push(...afterDate);

			// at least one of the repos
			if (afterDate.length !== response.data.length) {
				break;
			}

			// if the response has less that the ones we ask for
			if (response.data.length < GitHubApi.PerPage) {
				break;
			}

			page += 1;
		}

		return repos;
	}

	/**
	 * @param {string} organization
	 * @param {string} repository
	 * @param {Date} fromDate
	 *
	 * @returns Promise<Array<PullRequest>>
	 */
	async fetchPullRequest(organization, repository, fromDate) {
		let page = 1;

		const pulls = [];

		for (; ;) {
			const response = await this.#octokit.request('GET /repos/{owner}/{repo}/pulls', {
				owner: organization,
				repo: repository,
				per_page: GitHubApi.PerPage,
				page: page,
				state: 'all',
				sort: 'updated',
				direction: 'desc',
			});

			const afterDate = response.data.filter(r => {
				return new Date(r.updated_at) >= fromDate;
			});

			pulls.push(...afterDate);

			// at least one of the repos
			if (afterDate.length !== response.data.length) {
				break;
			}

			// if the response has less that the ones we ask for
			if (response.data.length < GitHubApi.PerPage) {
				break;
			}

			page += 1;
		}

		return pulls;
	}

	/**
	 * @param {string} organization
	 * @param {string} repository
	 * @param {number} pr
	 */
	async fetchPullRequestReviews(organization, repository, pr) {
		const response = await this.#octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
			owner: organization,
			repo: repository,
			pull_number: pr
		});

		return response.data;
	}

	/**
	 * @param {string} organization
	 * @param {string} repository
	 * @param {number} prNumber
	 */
	async fetchCommitsFromPullRequest(organization, repository, prNumber) {
		let page = 1;

		const commits = [];

		for (; ;) {
			const response = await this.#octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', {
				owner: organization,
				repo: repository,
				pull_number: prNumber,
				state: 'closed',
				per_page: GitHubApi.PerPage,
				page: page,
				sort: 'updated',
				direction: 'desc',
				headers: {
					'Time-Zone': 'America/Mexico_City',
				}
			});

			commits.push(...response.data);

			// if the response has less that the ones we ask for
			if (response.data.length < GitHubApi.PerPage) {
				break;
			}

			page += 1;
		}

		if (true) {
			this.#logger.info(`${organization}/${repository}: found ${commits.length} in pull request ${prNumber}`);
		}

		return commits;
	}

	/**
	* @param {string} organization
	*/
	async fetchUsers(organization) {
		const response = await this.#octokit.request('GET /orgs/{org}/members', {
			org: organization,
			filter: 'all',
			per_page: GitHubApi.PerPage,
			page: 1,
			headers: {
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});

		return response.data;
	}

	/**
	* @param {string} organization
	* @param {string} repository
	*
	* @returns Promise<{ title: string; id: number; }[]>
	*/
	async fetchDeployKeys(organization, repository) {
		const response = await this.#octokit.request('GET /repos/{owner}/{repo}/keys', {
			owner: organization,
			repo: repository,
			per_page: GitHubApi.PerPage,
			page: 1,
		});

		return response.data;
	}

	/**
	* @param {string} organization
	* @param {string} repository
	* @param {string} key
	*/
	async createDeployKey(organization, repository, key) {
		const response = await this.#octokit.request('POST /repos/{owner}/{repo}/keys', {
			owner: organization,
			repo: repository,
			title: 'codepulse@nuclea.solutions',
			key: key,
			read_only: true,
			headers: {
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});

		return response;
	}

	/**
	* @param {string} organization
	* @param {string} repository
	* @param {string} keyId
	*/
	async deleteDeployKey(organization, repository, keyId) {
		const response = await this.#octokit.request('DELETE /repos/{owner}/{repo}/keys/{key_id}', {
			owner: organization,
			repo: repository,
			key_id: keyId,
			headers: {
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});

		return response;
	}

	/**
	* @param {string} organization
	*
	* @returns Promise<{ id: string; type: string; name: string; events: string[]; active: boolean; }>
	*/
	async getWebhooks(organization) {
		const response = await this.#octokit.request('GET /orgs/{org}/hooks', {
			org: organization,
			headers: {
				'X-GitHub-Api-Version': '2022-11-28'
			}
		})

		return response.data;
	}

	/**
	* @param {object} opts
	* @param {string} opts.name
	* @param {string} opts.organization
	* @param {string} opts.url
	* @param {Array<string>} opts.events
	*
	* @returns Promise<{ id: string; type: string; name: string; events: string[]; active: boolean; }>
	*/
	async createWebhook(opts) {
		const response = await this.#octokit.request('POST /orgs/{org}/hooks', {
			org: opts.organization,
			name: opts.name,
			active: true,
			events: opts.events,
			config: {
				url: opts.url,
				content_type: 'json',
			},
			headers: {
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});

		return response;

	}
}
