import { GH_WEBHOOK_SECRET } from './env.js';
import { WebhookManager } from './webhook-manager.js';

export const wm = new WebhookManager(GH_WEBHOOK_SECRET);
