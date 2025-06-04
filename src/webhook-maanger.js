import assert from 'node:assert';
import { GitHubApi } from "./github-api.js";

const WebhookName = "web";

const WebhookEvents = ['push', 'pull_request'];

export class WebhookManager {
	/**
	* @type {GitHubApi}
	* @access private
	*/
	#api;

	/**
	 * @param {GitHubApi} api
	 */
	setApi(api) {
		this.#api = api;
	}

	/**
	* @param {string} organization
	* @param {string} url
	*/
	async getOrCreate(organization, url) {
		assert(this.#api, "use getApi before calling getOrCreate or any other method");

		const webhooks = await this.#api.getWebhooks(organization);
		const index = webhooks.findIndex(w => w.name === WebhookName);
		if (index === -1) {
			const response = await this.#api.createWebhook({
				name: WebhookName,
				organization: organization,
				url: url,
				events: WebhookEvents,
			});

			assert(response.status === 201, "error creating webhook");
			return response.data;
		}

		return webhooks[index];
	}
}
