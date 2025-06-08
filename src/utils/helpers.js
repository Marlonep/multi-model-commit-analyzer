/**
 * Utility Helper Functions
 * 
 * Common utility functions used across the application
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Generate random string for IDs
 */
export function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Sanitize filename for safe file operations
 */
export function sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
}

/**
 * Parse git commit hash to short format
 */
export function getShortHash(hash) {
    return hash ? hash.substring(0, 7) : '';
}

/**
 * Format commit message for display
 */
export function formatCommitMessage(message, maxLength = 60) {
    if (!message) return '';
    
    // Get first line only
    const firstLine = message.split('\n')[0];
    
    if (firstLine.length <= maxLength) {
        return firstLine;
    }
    
    return firstLine.substring(0, maxLength - 3) + '...';
}

/**
 * Calculate percentage with precision
 */
export function calculatePercentage(value, total, precision = 1) {
    if (total === 0) return 0;
    return parseFloat(((value / total) * 100).toFixed(precision));
}

/**
 * Debounce function calls
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * Sleep function for async operations
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry(fn, maxAttempts = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxAttempts) {
                throw error;
            }
            await sleep(delay * Math.pow(2, attempt - 1));
        }
    }
}

/**
 * Parse command line arguments
 */
export function parseArgs(args = process.argv.slice(2)) {
    const parsed = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const key = arg.substring(2);
            const nextArg = args[i + 1];
            
            if (nextArg && !nextArg.startsWith('--')) {
                parsed[key] = nextArg;
                i++; // Skip next argument as it's a value
            } else {
                parsed[key] = true;
            }
        }
    }
    
    return parsed;
}