/**
 * Input type for formatAccountHandle.
 * Uses optional properties to handle malformed data gracefully.
 */
type AccountHandleInput = {
    instanceUrl: string;
    account: { acct?: string | null; username?: string | null };
};

/**
 * Safely extracts hostname from instance URL.
 * Falls back to regex extraction if URL constructor fails.
 * Returns empty string for null/undefined input.
 */
function safeHostname(instanceUrl: string): string {
    if (!instanceUrl) return '';
    try {
        return new URL(instanceUrl).hostname;
    } catch {
        // Fallback: strip protocol and path
        return instanceUrl
            .trim()
            .replace(/^[a-z][a-z\d+.-]*:\/\//i, '')
            .split(/[/?#]/)[0];
    }
}

/**
 * Formats account handle for display.
 * If acct already contains '@', returns it as-is (remote account).
 * Otherwise, appends the instance hostname.
 * Returns null if neither acct nor username is available.
 */
export function formatAccountHandle(session: AccountHandleInput): string | null {
    const acct = (session.account.acct ?? session.account.username ?? '').trim().replace(/^@+/, '');
    if (!acct) return null;
    if (acct.includes('@')) {
        return `@${acct}`;
    }
    const host = safeHostname(session.instanceUrl);
    return host ? `@${acct}@${host}` : `@${acct}`;
}
