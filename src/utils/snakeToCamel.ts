/**
 * Utility functions to convert snake_case keys to camelCase
 * Used for Mastodon Streaming API which returns snake_case JSON
 */

/**
 * Convert a snake_case string to camelCase
 */
export function snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively convert all object keys from snake_case to camelCase
 * Handles nested objects and arrays
 */
export function convertKeysToCamelCase<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => convertKeysToCamelCase(item)) as T;
    }

    if (typeof obj === 'object') {
        const converted: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            const camelKey = snakeToCamel(key);
            converted[camelKey] = convertKeysToCamelCase(value);
        }
        return converted as T;
    }

    return obj;
}
