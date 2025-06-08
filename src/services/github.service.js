/**
 * GitHub Service
 * 
 * Handles GitHub API interactions and repository information extraction
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitHubService {
    /**
     * Extract GitHub organization and repository from remote URL
     */
    static async getOrganizationFromRemote() {
        try {
            const { stdout } = await execAsync('git config --get remote.origin.url');
            const remoteUrl = stdout.trim();
            
            // Parse GitHub URL to extract organization
            const match = remoteUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
            if (match) {
                return {
                    organization: match[1],
                    repository: match[2].replace(/\.git$/, ''),
                    url: remoteUrl
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error getting GitHub remote:', error.message);
            return null;
        }
    }

    /**
     * Get current branch information
     */
    static async getCurrentBranch() {
        try {
            const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
            return stdout.trim();
        } catch (error) {
            console.error('Error getting current branch:', error.message);
            return null;
        }
    }

    /**
     * Get repository status
     */
    static async getRepositoryStatus() {
        try {
            const [remoteInfo, currentBranch] = await Promise.all([
                this.getOrganizationFromRemote(),
                this.getCurrentBranch()
            ]);

            return {
                ...remoteInfo,
                currentBranch,
                isGitRepository: true
            };
        } catch (error) {
            console.error('Error getting repository status:', error.message);
            return {
                isGitRepository: false,
                error: error.message
            };
        }
    }

    /**
     * Extract GitHub username from commit author
     */
    static extractGitHubUsername(authorEmail) {
        // Handle GitHub noreply emails
        const noreplyMatch = authorEmail.match(/(\d+)\+(.+)@users\.noreply\.github\.com/);
        if (noreplyMatch) {
            return noreplyMatch[2];
        }

        // For other emails, extract the part before @
        const emailMatch = authorEmail.match(/^([^@]+)@/);
        if (emailMatch) {
            return emailMatch[1];
        }

        return null;
    }
}