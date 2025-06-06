import assert from 'node:assert';
import Nodegit from 'nodegit';
import { promises as fs } from 'node:fs';
import { exec } from 'node:child_process';
import path from 'node:path';
import { fileExists, spawn, convertCommitTimezoneOffset } from './utils';
import { logger } from './logger.js';
import { GitHubApi } from './github-api';

export class Stats {
	constructor() {
		this.commits = [];
		this.hash_set = new Set();

		this.commits_ = {};
		this.merge_commits_ = [];
	}

	doesCommitMessageExists(message) {
		for (const [refMessage, _] of Object.entries(this.commits_)) {
			if (refMessage.includes(message)) {
				return true;
			}
		}

		return false;
	}

	doesCommitExists(commit) {
		assert('username' in commit, 'commit has no username');
		assert('hash' in commit, 'commit has no hash');

		for (const [refMessage, _] of Object.entries(this.commits_)) {
			if (refMessage.includes(commit.message) && this.hash_set.has(commit.hash)) {
				const against = this.commits.find(c => c.hash === commit.hash);
				if (against.username === commit.username) {
					return true;
				}
			}
		}

		return false;
	}

	doesHashExists(hash) {
		return this.hash_set.has(hash);
	}

	/**
	 * @param {string} commit
	 */
	addMergeCommit(commit) {
		this.merge_commits_.push(commit);
	}

	/**
	 * @param {Array<any>} commits
	 */
	addCommits(commits) {
		for (const commit of commits) {
			// skip for reviews
			if (commit.type !== 'commit') {
				this.hash_set.add(commit.hash);
				this.commits.push(commit);
				continue;
			}

			if (this.merge_commits_.includes(commit.hash)) {
				// this.#logger.info(`[${commit.hash}]: skipping commit due to coming from merge`);
				// skip the ones that come from pull review
				continue;
			}

			const exists = this.doesCommitExists(commit);
			if (exists) {
				// this.#logger.warn(`[${commit.hash}]: ${commit.message}`);
				continue;
			}

			// check if we split the message in lines since a merge commit is usually
			// the join by `\n` of each of the commits from the pr
			// let lines = commit.message.split('\n')
			// 	.map(line => line.replace(/\r\n\t/, "").trim())
			// 	.map(line => line.replace('*', "").trim())
			// 	.filter(line => line.length > 0);
			// if (lines.length > 1) {
			// 	lines = lines.slice(1);
			// 	this.#logger.info(`[${commit.hash}]: due to possible merge`);
			//
			// 	const results = lines.map(line => this.doesCommitMessageExists(line));
			// 	const matches = results.filter(c => c).length;
			//
			// 	// if matches are above 80%, it means we're probably dealing with a merge
			// 	if ((matches / results.length) > .8) {
			// 		isDebug() && console.log('skipping message', lines);
			// 		continue;
			// 	}
			//
			// 	this.#logger.info(`[${commit.hash}]: adding to hash_set`);
			// }

			this.commits_[commit.message] = '';

			if (!this.hash_set.has(commit.hash)) {
				this.hash_set.add(commit.hash);
			}

			// push commit no matter what
			this.commits.push(commit);
		}
	}
}

export class RepositoryScanner {
	/**
	 * @type {GitHubApi}
	 * @access private
	 */
	#api;

	#emailToUsernameCache = {};

	/**
	 * @type {Array<any>}
	 * @access private
	 */
	#members = [];

	/**
	* @param {string} organization
	* @param {string} repository
	*/
	constructor(organization, repository) {
		this.organization = organization;
		this.repository = repository;
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.sshKeyPath
	 * @param {string} opts.sshUrl
	 * @param {string} opts.tmpDir
	 *
	 * @returns Promise<string>
	 */
	async clone(opts) {
		assert(opts.tmpDir, "tmp dir for repositories missing");

		const repoPath = path.join(opts.tmpDir, this.repository);
		const repoExists = await fileExists(repoPath);

		if (repoExists) {
			await fs.rmdir(repoPath);
		}

		const result = await new Promise((resolve, reject) => {
			const cmd = `GIT_SSH_COMMAND='ssh -i ${opts.sshKeyPath} -o IdentitiesOnly=yes -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -F /dev/null' git clone ${opts.sshUrl} ${repoPath}`;
			exec(cmd, (error, stdout, stderr) => {
				if (error) {
					reject(error);
				}

				resolve(0);
			})
		});
		assert(result === 0, `repository-scanner: there was an error cloning the repository ${name}`);

		return repoPath;
	}

	/**
	 * @param {object} opts
	 * @param {string} opts.path
	 * @param {string} opts.defaultBranch
	 * @param {string} opts.sshKeyPath
	 */
	async fetch(opts) {
		await new Promise((resolve, reject) => {
			exec(`GIT_SSH_COMMAND='ssh -i ${opts.sshKeyPath} -o IdentitiesOnly=yes -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -F /dev/null' git fetch origin --prune`, {
				cwd: opts.path,
			}, (error) => {
				// @@@: Improve error handling
				if (error) {
					reject(error);
				}

				resolve(0);
			});
		});

		let code = await spawn('git', ['reset', '--hard',], {
			cwd: path,
		});
		assert(code === 0, `there was an error reseting default branch`);
		await spawn('git', ['checkout', opts.defaultBranch], {
			cwd: opts.path
		});
	}

	/**
	 * @param {string} path
	 *
	 * @returns Array<string, Array<string>>
	 */
	async #getBranches(path) {
		let repo = await Nodegit.Repository.open(path);

		const branches = [];
		let mainBranch = '';
		const references = await repo.getReferences();
		for (const ref of references) {
			if (ref.isRemote()) {
				branches.push(ref.name());
			}

			if (ref.isBranch()) {
				mainBranch = ref.name();
			}
		}

		return [mainBranch, branches];
	}

	/**
	* @param {Nodegit.Repository} repo
	* @param {Date} fromDate
	*
	* @returns {Promise<Array<Nodegit.Commit>>}
	*/
	async #getCommits(repo, fromDate) {
		const commit = await repo.getHeadCommit();
		const commits = await (new Promise((resolve, reject) => {
			const commits = [];
			const eventEmitter = commit.history();

			/**
			 * @param {Nodegit.Commit} commit
			 */
			const handler = function(commit) {
				const date = commit.date();
				if (date >= fromDate)
					commits.push(commit);
				else
					eventEmitter.removeListener('commit', handler);
			}

			eventEmitter.on('commit', handler)

			eventEmitter.on('end', function(_) {
				resolve(commits);
			})

			eventEmitter.on('error', function(e) {
				reject(e);
			})

			eventEmitter.start();
		}));

		return commits;
	}


	/**
	 * @param {object} opts
	 * @param {string} opts.path
	 * @param {string} opts.branch
	 */
	async extractCommitsData(opts) {
		// checkout to another branch
		await spawn('git', ['checkout', opts.branch], {
			cwd: opts.path,
		});

		const repo = await Nodegit.Repository.open(opts.path);
		const referenceDate = new Date(2025, 5, 1, 0, 0, 0);
		const commits = await this.#getCommits(repo, referenceDate);
		const computed = [];
		for (const commit of commits) {
			const diff = await commit.getDiff();
			const stats = await diff[0].getStats();
			const author = commit.author();
			const message = commit.message();
			const email = author.email();
			let usernames = [this.getUsername(email)];

			if (usernames[0] === "" && (email.includes("FlutterFlowEng@users.noreply.github.com") || email.includes("users.noreply.github.com"))) {
				usernames = [];
				for (const [k, v] of Object.entries(this.#emailToUsernameCache)) {
					if (message.toLowerCase().includes(k) || email.includes(v)) {
						usernames.push(v);
					}
				}
			}

			for (const username of usernames) {
				computed.push({
					branch: opts.branch,
					hash: commit.id().tostrS(),
					message: message,
					added_lines: stats.insertions(),
					deleted_lines: stats.deletions(),
					name: author.name(),
					email: author.email(),
					created_at: commit.date(),
					username: username,
					repository: this.repository,
					organization: this.organization,
					timezone_offset: convertCommitTimezoneOffset(commit.timeOffset()),
					type: 'commit',
					from: 'raw'
				})
			}
		}

		return computed;
	}

	/**
	* @param {object} pr
	* @param {number} pr.number
	*/
	async commitsFromPullRequest(pr) {
		const commits = await this.#api.fetchCommitsFromPullRequest(this.organization, this.repository, pr.number);
		const data = commits.map(commit => {
			const author = commit.commit.author.email;
			const email = commit.commit.committer.email;
			const message = commit.commit.message;
			const createdAt = new Date(commit.commit.committer.date);
			let username = this.getUsername(author);

			if (username === "" && (email.includes("FlutterFlowEng@users.noreply.github.com") || email.includes("users.noreply.github.com"))) {
				for (const [k, v] of Object.entries(this.#emailToUsernameCache)) {
					if (message.toLowerCase().includes(k) || email.includes(v)) {
						username = v;
						break;
					}
				}
			}

			return {
				branch: '',
				hash: commit.sha,
				message: commit.commit.message,
				added_lines: 0,
				deleted_lines: 0,
				name: commit.commit.committer.name,
				email: commit.commit.committer.email,
				created_at: createdAt,
				username: username,
				repository: this.repository,
				organization: this.organization,
				timezone_offset: convertCommitTimezoneOffset(-createdAt.getTimezoneOffset()),
				type: 'commit',
				from: 'pr'
			}
		});
		return data;
	}

	/**
	* @param {Stats} stats
	*/
	async extractCommitsFromPullRequests(stats) {
		const referenceDate = new Date(2025, 4, 1, 0, 0, 0);
		const prs = (await this.#api.fetchPullRequest(this.organization, this.repository, referenceDate));
		logger.info(`${this.organization}/${this.repository}: number of prs ${prs.length}`);

		for (const pr of prs) {
			const commits = await this.commitsFromPullRequest(pr);
			const finalCommits = commits.map(commit => {
				return {
					...commit,
					branch: pr.head.ref,
				}
			})

			stats.addCommits(finalCommits);
			stats.addMergeCommit(pr.merge_commit_sha);

			const reviews = await this.#api.fetchPullRequestReviews(this.organization, this.repository, pr.number);
			for (const rev of reviews) {
				if (rev.state === 'APPROVED') {
					stats.addCommits([{
						branch: pr.head.ref,
						hash: pr.merge_commit_sha,
						message: pr.title,
						added_lines: 0,
						deleted_lines: 0,
						name: rev.user.login,
						email: '',
						created_at: new Date(rev.submitted_at),
						timezone_offset: convertCommitTimezoneOffset(-(new Date(rev.submitted_at).getTimezoneOffset())),
						username: rev.user.login,
						repository: this.repository,
						organization: this.organization,
						type: 'review',
						from: 'pr'
					}]);
				}
			}
		}
	}

	/**
	 * @param {string} email
	 *
	 * @returns {string}
	 */
	getUsername(email) {
		if (email in this.#emailToUsernameCache) {
			return this.#emailToUsernameCache[email];
		}

		for (const member of this.#members) {
			if (email.includes(member.login)) {
				this.#emailToUsernameCache[email] = member.login;

				return member.login;
			}
		}

		return "";
	}


	/*
	 * @param {object} opts
	 * @param {string} opts.path
	 * @param {string} opts.defaultBranch
	 * @param {string} opts.sshKeyPath
	 *
	 */
	async scan(opts) {
		const stats = new Stats();

		await this.extractCommitsFromPullRequests(stats);

		await this.fetch({
			path: opts.path,
			defaultBranch: opts.defaultBranch,
			sshKeyPath: opts.sshKeyPath,
		});
		const [_, branches] = await this.#getBranches(opts.path);
		for (const branch of branches) {
			const commits = await this.extractCommitsData({
				path: opts.path,
				branch: branch,
			});
			stats.addCommits(commits);
		}

		await spawn('git', ['checkout', opts.defaultBranch], {
			cwd: path
		});
	}

}
