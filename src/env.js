import { envPresentOrThrow } from "./utils.js";

export const GH_WEBHOOK_SECRET = envPresentOrThrow('GH_WEBHOOK_SECRET');
