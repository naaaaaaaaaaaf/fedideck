import type { mastodon } from 'masto';
import type { CustomEmoji } from '../api/mastoClient';

export interface Session {
    id: string;
    instanceUrl: string;
    accessToken: string;
    account: mastodon.v1.Account;
    emojis: CustomEmoji[];
    createdAt: number;
}

const STORAGE_KEY = 'fedideck:sessions';

/**
 * Load all saved sessions from localStorage
 */
export function loadSessions(): Session[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

/**
 * Save a new session
 */
export function saveSession(session: Session): void {
    const sessions = loadSessions();

    // Remove existing session for the same account if present
    const filtered = sessions.filter((s) => s.id !== session.id);
    filtered.push(session);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Remove a session
 */
export function removeSession(sessionId: string): void {
    const sessions = loadSessions();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Get a specific session by ID
 */
export function getSession(sessionId: string): Session | undefined {
    const sessions = loadSessions();
    return sessions.find((s) => s.id === sessionId);
}

/**
 * Clear all sessions (logout all)
 */
export function clearAllSessions(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Create a session from account credentials
 */
export function createSession(
    instanceUrl: string,
    accessToken: string,
    account: mastodon.v1.Account,
    emojis: CustomEmoji[] = []
): Session {
    return {
        id: `${account.id}@${new URL(instanceUrl).hostname}`,
        instanceUrl,
        accessToken,
        account,
        emojis,
        createdAt: Date.now(),
    };
}
