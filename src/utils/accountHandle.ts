import type { Session } from '../auth/sessions';

/**
 * Safely extracts hostname from instance URL.
 * Falls back to regex extraction if URL constructor fails.
 */
function safeHostname(instanceUrl: string): string {
    try {
        return new URL(instanceUrl).hostname;
    } catch {
        // Fallback: strip protocol and path
        return instanceUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }
}

/**
 * Formats account handle for display.
 * If acct already contains '@', returns it as-is (remote account).
 * Otherwise, appends the instance hostname.
 */
export function formatAccountHandle(session: Pick<Session, 'instanceUrl' | 'account'>): string {
    const acct = session.account.acct.replace(/^@/, '');
    if (acct.includes('@')) {
        return `@${acct}`;
    }
    return `@${acct}@${safeHostname(session.instanceUrl)}`;
}
