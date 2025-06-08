/**
 * Key Manager Service
 * 
 * Handles API key management and validation for various AI services
 */

import { config } from 'dotenv';

// Load environment variables
config();

export class KeyManagerService {
    /**
     * Get all available API keys
     */
    static getApiKeys() {
        return {
            openai: process.env.OPENAI_API_KEY,
            claude: process.env.CLAUDE_API_KEY,
            gemini: process.env.GEMINI_API_KEY,
            grok: process.env.GROK_API_KEY
        };
    }

    /**
     * Check which API keys are configured
     */
    static getAvailableServices() {
        const keys = this.getApiKeys();
        const available = {};

        for (const [service, key] of Object.entries(keys)) {
            available[service] = {
                configured: !!key,
                hasKey: !!key,
                keyLength: key ? key.length : 0
            };
        }

        return available;
    }

    /**
     * Validate API key format for specific services
     */
    static validateKeyFormat(service, key) {
        if (!key) return false;

        const patterns = {
            openai: /^sk-[A-Za-z0-9]{48,}$/,
            claude: /^sk-ant-[A-Za-z0-9-]{95,}$/,
            gemini: /^[A-Za-z0-9_-]{39}$/,
            grok: /^xai-[A-Za-z0-9_-]+$/
        };

        const pattern = patterns[service];
        return pattern ? pattern.test(key) : true;
    }

    /**
     * Get service status for all AI models
     */
    static getServiceStatus() {
        const keys = this.getApiKeys();
        const status = {};

        for (const [service, key] of Object.entries(keys)) {
            status[service] = {
                available: !!key,
                valid: this.validateKeyFormat(service, key),
                configured: !!key
            };
        }

        return status;
    }

    /**
     * Mask API key for display purposes
     */
    static maskApiKey(key) {
        if (!key) return 'Not configured';
        if (key.length < 8) return '*'.repeat(key.length);
        
        return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
    }

    /**
     * Get API key configuration summary
     */
    static getConfigurationSummary() {
        const keys = this.getApiKeys();
        const summary = {};

        for (const [service, key] of Object.entries(keys)) {
            summary[service] = {
                configured: !!key,
                masked: this.maskApiKey(key),
                valid: this.validateKeyFormat(service, key)
            };
        }

        return summary;
    }
}