import assert from 'node:assert';
import { logger } from "./logger.js";
import { GitHubApi } from "./github-api.js";
import { Webhooks, createNodeMiddleware } from '@octokit/webhooks';

const Config = {
	Path: '/api/gh-webhook',
	Name: 'web',
	Events: ['push', 'pull_request']
};

export class WebhookManager {
	/**
	* @type {string}
	* @access private
	*/
	#secret = '';

	/**
	* @type {GitHubApi}
	* @access private
	*/
	#api;

	/**
	 * @param {string} secret
	 */
	constructor(secret) {
		this.#secret = secret;
	}

	/**
	 * @param {GitHubApi} api
	 */
	setApi(api) {
		this.#api = api;
	}

	getMiddleware() {
		const webhooks = new Webhooks({
			secret: this.#secret,
		});

		webhooks.onAny(this.handleEvent);

		return createNodeMiddleware(webhooks, { path: Config.Path });
	}

	/**
	* @param {string} organization
	* @param {string} url
	*/
	async getOrCreate(organization, url) {
		assert(this.#api, "use getApi before calling getOrCreate or any other method");

		const webhooks = await this.#api.getWebhooks(organization);
		const index = webhooks.findIndex(w => w.name === Config.Name);
		if (index === -1) {
			const response = await this.#api.createWebhook({
				name: Config.Name,
				organization: organization,
				url: url,
				events: Config.Events,
				secret: this.#secret,
			});

			assert(response.status === 201, "error creating webhook");
			return response.data;
		}

		return webhooks[index];
	}

	/**
	* @param {import('@octokit/webhooks').EmitterWebhookEvent} event
	*/
	async handleEvent(event) {
		logger.info(`incoming event: ${event.name}`);
		switch (event.name) {
			case "push": {
			} break;
		}
	}
}
