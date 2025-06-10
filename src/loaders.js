import { GH_WEBHOOK_SECRET, SSH_STORAGE_PATH } from './env.js';
import { WebhookManager } from './webhook-manager.js';
import { KeyManager } from './key-manager.js';

export const wm = new WebhookManager(GH_WEBHOOK_SECRET);
export const km = new KeyManager(SSH_STORAGE_PATH);
