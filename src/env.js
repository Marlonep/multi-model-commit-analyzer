import { envPresentOrThrow } from "./utils.js";

export const GH_WEBHOOK_SECRET = envPresentOrThrow('GH_WEBHOOK_SECRET');
export const SSH_STORAGE_PATH = envPresentOrThrow('SSH_STORAGE_PATH');

export const REDIS_URL = envPresentOrThrow('REDIS_URL');
