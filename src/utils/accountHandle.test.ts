import { describe, it, expect } from 'vitest';
import { formatAccountHandle } from './accountHandle';

describe('formatAccountHandle', () => {
    it('formats local account with hostname', () => {
        const result = formatAccountHandle({
            instanceUrl: 'https://mastodon.social',
            account: {
                id: '1',
                username: 'testuser',
                acct: 'testuser',
            } as const,
        });
        expect(result).toBe('@testuser@mastodon.social');
    });

    it('does not duplicate domain when acct contains @', () => {
        const result = formatAccountHandle({
            instanceUrl: 'https://mastodon.social',
            account: {
                id: '1',
                username: 'remoteuser',
                acct: 'remoteuser@example.com',
            } as const,
        });
        expect(result).toBe('@remoteuser@example.com');
    });

    it('handles invalid instanceUrl gracefully', () => {
        const result = formatAccountHandle({
            instanceUrl: 'invalid-url',
            account: {
                id: '1',
                username: 'testuser',
                acct: 'testuser',
            } as const,
        });
        expect(result).toBe('@testuser@invalid-url');
    });

    it('strips leading @ from acct if present', () => {
        const result = formatAccountHandle({
            instanceUrl: 'https://mastodon.social',
            account: {
                id: '1',
                username: 'testuser',
                acct: '@testuser',
            } as const,
        });
        expect(result).toBe('@testuser@mastodon.social');
    });

    it('handles URL with trailing slash', () => {
        const result = formatAccountHandle({
            instanceUrl: 'https://mastodon.social/',
            account: {
                id: '1',
                username: 'testuser',
                acct: 'testuser',
            } as const,
        });
        expect(result).toBe('@testuser@mastodon.social');
    });
});
