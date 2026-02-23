import { describe, it, expect } from 'vitest';
import {
    getDisplayStatus,
    getDisplayStatusOrNull,
    hasContentWarning,
    getReblogger,
} from './statusView';
import type { mastodon } from 'masto';

// Helper to create minimal mock status
function createMockStatus(overrides: Partial<mastodon.v1.Status> = {}): mastodon.v1.Status {
    return {
        id: '1',
        createdAt: '2024-01-01T00:00:00Z',
        uri: 'https://example.com/status/1',
        url: 'https://example.com/@user/1',
        account: {
            id: '1',
            username: 'user',
            displayName: 'User',
            url: 'https://example.com/@user',
            acct: 'user@example.com',
            createdAt: '2024-01-01T00:00:00Z',
            followersCount: 0,
            followingCount: 0,
            statusesCount: 0,
            note: '',
            avatar: '',
            avatarStatic: '',
            header: '',
            headerStatic: '',
            emojis: [],
            fields: [],
            locked: false,
            bot: false,
            group: false,
            discoverable: false,
            noindex: false,
            suspended: false,
            limited: false,
        },
        content: '',
        visibility: 'public',
        sensitive: false,
        spoilerText: '',
        mediaAttachments: [],
        mentions: [],
        tags: [],
        emojis: [],
        reblogsCount: 0,
        favouritesCount: 0,
        repliesCount: 0,
        ...overrides,
    } as mastodon.v1.Status;
}

describe('statusView utilities', () => {
    describe('getDisplayStatus', () => {
        it('returns the status itself when not a reblog', () => {
            const status = createMockStatus({ id: '123' });
            expect(getDisplayStatus(status)).toBe(status);
        });

        it('returns the original status when it is a reblog', () => {
            const originalStatus = createMockStatus({ id: 'original' });
            const reblogStatus = createMockStatus({
                id: 'reblog',
                reblog: originalStatus,
            });
            expect(getDisplayStatus(reblogStatus)).toBe(originalStatus);
        });
    });

    describe('getDisplayStatusOrNull', () => {
        it('returns null for null input', () => {
            expect(getDisplayStatusOrNull(null)).toBeNull();
        });

        it('returns null for undefined input', () => {
            expect(getDisplayStatusOrNull(undefined)).toBeNull();
        });

        it('returns the status itself for non-null input', () => {
            const status = createMockStatus({ id: '123' });
            expect(getDisplayStatusOrNull(status)).toBe(status);
        });

        it('returns the original status for reblog', () => {
            const originalStatus = createMockStatus({ id: 'original' });
            const reblogStatus = createMockStatus({
                id: 'reblog',
                reblog: originalStatus,
            });
            expect(getDisplayStatusOrNull(reblogStatus)).toBe(originalStatus);
        });
    });

    describe('hasContentWarning', () => {
        it('returns false for empty spoiler text', () => {
            const status = createMockStatus({ spoilerText: '' });
            expect(hasContentWarning(status)).toBe(false);
        });

        it('returns true for non-empty spoiler text', () => {
            const status = createMockStatus({ spoilerText: 'Warning!' });
            expect(hasContentWarning(status)).toBe(true);
        });
    });

    describe('getReblogger', () => {
        it('returns null when not a reblog', () => {
            const status = createMockStatus();
            expect(getReblogger(status)).toBeNull();
        });

        it('returns the reblogger account when it is a reblog', () => {
            const originalStatus = createMockStatus({ id: 'original' });
            const reblogger = createMockStatus({ id: 'reblogger' }).account;
            const reblogStatus = createMockStatus({
                id: 'reblog',
                reblog: originalStatus,
                account: reblogger,
            });
            expect(getReblogger(reblogStatus)).toBe(reblogger);
        });
    });
});
