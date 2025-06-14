import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Octokit } from "octokit";
import { GitHubApi } from "../github-api.js";
import { qa, wm } from "../loaders.js";
import { createSublogger } from "../logger.js";
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
        const logger = createSublogger('scan-service');
        const api = new GitHubApi(new Octokit({ auth: this.#key }), logger);
        wm.setApi(api);
        const km = new KeyManager(SSH_STORAGE_PATH);
        km.setApi(api);
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `code-${this.organization}`));
        logger.info(`temp dir: ${tmpDir}`);
        const repo = await api.fetchRepository(this.organization, this.repository.name);

        const members = dbHelpers.getAllUsers().map(u => u.username);
        const scanner = new RepositoryScanner(this.organization, this.repository.name, api);
        scanner.setMembers(members);
        scanner.setEmailToUsernameCache({
            "jeduardo.fuentes@alumnos.udg.mx": "jeduardofr",
            "tmario1508@gmail.com": "tmario1508",
            "natalia@nuclea.solutions": "natalianavarrot",
            "brandonalberto_851@outlook.com": "Brandon851",
            "brandon@nuclea.solutions": "Brandon851",
            "gerardo@nuclea.solutions": "GerryEspinoza126",
            "day@nuclea.solutions": "DayRamirezz",
            "jacobojacome2@gmail.com": "JacoboJacome",
            "jacobo@nuclea.solutions": "JacoboJacome",
            "santiago@nuclea.solutions": "Jacome-san1",
            "santiagojacomeacosta@gmail.com": "Jacome-san1",
            "Santiago@nucle.solutions": "Jacome-san1",
            "sebastian@nuclea.solutions": "sebastiannuclea",
            "victoria@nuclea.solutions": "victoriamoroni",
            "marco@nuclea.solutions": "mahz24",
            "mah": "mahz24",
            "maahz24": "mahz24",
            "kevinvr@hotmail.es": "Fairbrook",
            "manuel8a31@hotmail.com": "Manuelo247",
            "device@comma.ai": "Fairbrook",
            "mhsiles1196@gmail.com": "MHSiles",
            "mar.ortega.v@gmail.com": "mareadelmar",
            "jdchavezgtz@gmail.com": "DavidChavez513",
            "guendulayrob@gmail.com": "robtry",
            "rgg.correo@gmail.com": "robtry",
            "day.happy_123@hotmail.com": "DayRamirezz",
            "GerardoEspinoza26": "GerryEspinoza126",
            "rodrigo.hernandez@nuclea.solutions": "RodriSebas",
            "lucasjoelcampodonico@gmail.com": "lucascampodonico",
            "angelluzdejesus@hotmail.com": "AngelLuzLU",
            "giltafollavictormanuel@gmail.com": "VicmanGT",
            "eduardochavezmartin10@gmail.com": "eduardohufg",
            "A01741413@tec.mx": "di3g0r",
            "rr15rr": "rr15rr",
            "VicmanGT": "VicmanGT",
            "victor@nuclea.solutions": "VictorIbarraFlores",
            "samuel@nuclea.solutions": "SamuelPadilla-Nuclea",
            "a22110197@ceti.mx": "JoseEG45"
        })
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

                logger.info(`adding commit from ${this.repository.name} with hash ${commit.hash}`)
                qa.add({ id: result.lastInsertRowid, hash: commit.hash, diff: commit.diff });
            }
        }

        return commits;
    }

}
