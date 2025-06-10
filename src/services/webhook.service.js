/**
 * Webhook Service
 * 
 * Handles webhook events and processing for GitHub and other integrations
 */

import { dbHelpers } from '../database/db.js';

export class WebhookService {
    /**
     * Process GitHub push event
     */
    static async processPushEvent(payload) {
        try {
            console.log('Processing GitHub push event...');
            
            const { repository, commits, ref } = payload;
            
            if (!commits || commits.length === 0) {
                return { success: true, message: 'No commits to process' };
            }

            // Extract repository information
            const repoInfo = {
                name: repository.name,
                fullName: repository.full_name,
                organization: repository.owner.login,
                url: repository.html_url,
                branch: ref.replace('refs/heads/', '')
            };

            console.log(`Processing ${commits.length} commits for ${repoInfo.fullName}`);

            // Process each commit
            const processedCommits = [];
            for (const commit of commits) {
                const processedCommit = await this.processCommit(commit, repoInfo);
                if (processedCommit) {
                    processedCommits.push(processedCommit);
                }
            }

            return {
                success: true,
                repository: repoInfo,
                processedCommits: processedCommits.length,
                message: `Successfully processed ${processedCommits.length} commits`
            };

        } catch (error) {
            console.error('Error processing push event:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process individual commit from webhook
     */
    static async processCommit(commit, repoInfo) {
        try {
            const commitData = {
                hash: commit.id,
                message: commit.message,
                author: commit.author.name,
                authorEmail: commit.author.email,
                timestamp: new Date(commit.timestamp),
                url: commit.url,
                repository: repoInfo.name,
                organization: repoInfo.organization,
                branch: repoInfo.branch
            };

            // Here you could trigger commit analysis
            // For now, just log the commit
            console.log(`Webhook commit: ${commitData.hash.substring(0, 7)} - ${commitData.message}`);

            return commitData;

        } catch (error) {
            console.error('Error processing commit:', error);
            return null;
        }
    }

    /**
     * Validate webhook signature (for security)
     */
    static validateSignature(payload, signature, secret) {
        if (!secret) {
            console.warn('No webhook secret configured');
            return true; // Allow if no secret is set
        }

        try {
            const crypto = require('crypto');
            const expectedSignature = 'sha256=' + crypto
                .createHmac('sha256', secret)
                .update(payload)
                .digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );
        } catch (error) {
            console.error('Error validating webhook signature:', error);
            return false;
        }
    }

    /**
     * Handle webhook event routing
     */
    static async handleWebhookEvent(eventType, payload, signature) {
        // Validate signature if secret is configured
        const secret = process.env.WEBHOOK_SECRET;
        if (secret && !this.validateSignature(JSON.stringify(payload), signature, secret)) {
            throw new Error('Invalid webhook signature');
        }

        switch (eventType) {
            case 'push':
                return await this.processPushEvent(payload);
            
            case 'ping':
                return { success: true, message: 'Webhook ping received' };
            
            default:
                return { 
                    success: true, 
                    message: `Event type '${eventType}' not handled` 
                };
        }
    }
}