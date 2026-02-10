/**
 * Returns the first non-empty string from the provided values.
 * Used for URL fallback chains where empty strings should be treated as missing values.
 * Unlike the nullish coalescing operator (??), this treats empty strings as falsy.
 */
export function firstNonEmpty(...values: (string | undefined | null)[]): string {
    for (const value of values) {
        if (value) return value;
    }
    return '';
}
