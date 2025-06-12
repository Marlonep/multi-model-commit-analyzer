import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Octokit } from "octokit";
import { GitHubApi } from "../github-api.js";
import { qa, wm } from "../loaders.js";
import { logger } from "../logger.js";
import { KeyManager } from "../key-manager.js";
import { RepositoryScanner } from '../repository-scanner.js';
import { SSH_STORAGE_PATH } from '../env.js';
import { dbHelpers } from '../database/db.js';

export class ScanService {
    #key = '';

    /**
    * @param {string} organization
    * @param {object} repository
    * @param {number} repository.id
    * @param {string} repository.name
    * @param {string} key
    */
    constructor(organization, repository, key) {
        this.organization = organization;
        this.repository = repository;
        this.#key = key;
    }

    async scan() {
        const api = new GitHubApi(new Octokit({ auth: this.#key }), logger);
        wm.setApi(api);
        const km = new KeyManager(SSH_STORAGE_PATH);
        km.setApi(api);
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `code-${this.organization}`));
        logger.info(`temp dir: ${tmpDir}`);
        const repo = await api.fetchRepository(this.organization, this.repository.name);

        const scanner = new RepositoryScanner(this.organization, this.repository.name, api);
        logger.info(`getting ssh key for: ${this.organization}/${this.repository.name}`);
        const keyPath = await km.findOrCreate(this.organization, this.repository.name);

        // clone repo
        logger.info(`cloning: ${this.organization}/${this.repository.name}`);
        const repoPath = await scanner.clone({
            sshKeyPath: keyPath,
            sshUrl: repo.ssh_url,
            tmpDir: tmpDir,
        });

        const ReferenceDate = new Date(2025, 5, 1, 0, 0, 0);
        logger.info(`scanning: ${this.organization}/${this.repository.name}`);
        const commits = await scanner.scan({
            referenceDate: ReferenceDate,
            path: repoPath,
            defaultBranch: repo.default_branch,
            sshKeyPath: keyPath,
        });

        logger.info(`commits: ${commits.length}`);
        let first = false;
        for (const commit of commits) {
            const record = await dbHelpers.getCommitByHash(commit.hash);
            if (record) {
                // check wether it has been analyzed
            } else {
                const result = dbHelpers.createCommit({
                    commit_hash: commit.hash,
                    user_name: commit.username,
                    project: this.repository.name,
                    organization: this.organization,
                    repository_id: this.repository.id,
                    commit_message: commit.message,
                    file_changes: 0,
                    timestamp: commit.created_at.toISOString(),
                    lines_added: commit.added_lines,
                    lines_deleted: commit.deleted_lines,
                })

                if (!first) {
                    logger.info(`adding commit from ${this.repository.name} with hash ${commit.hash}`)
                    qa.add({ id: result.lastInsertRowid, hash: commit.hash, diff: commit.diff });

                    first = true;
                }
            }
        }

        return commits;
    }

}
