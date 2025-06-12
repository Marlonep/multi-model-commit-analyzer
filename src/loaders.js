import { GH_WEBHOOK_SECRET, REDIS_URL, SSH_STORAGE_PATH } from './env.js';
import { WebhookManager } from './webhook-manager.js';
import { KeyManager } from './key-manager.js';
import { QueueService } from './services/queue.service.js';

export const wm = new WebhookManager(GH_WEBHOOK_SECRET);
export const km = new KeyManager(SSH_STORAGE_PATH);
export const qa = new QueueService({
	redisUrl: REDIS_URL,
	numberConcurrency: 5,
});
