import { describe, it, expect, beforeEach } from 'vitest';
import type { mastodon } from 'masto';
import {
    loadSessions,
    saveSession,
    removeSession,
    getSession,
    clearAllSessions,
    createSession,
    type Session,
} from '../auth/sessions';

// Mock account data for testing - cast to mastodon.v1.Account once
const mockAccount = {
    id: '12345',
    username: 'testuser',
    acct: 'testuser',
    displayName: 'Test User',
    locked: false,
    bot: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    note: 'Test bio',
    url: 'https://mastodon.social/@testuser',
    avatar: 'https://example.com/avatar.png',
    avatarStatic: 'https://example.com/avatar.png',
    header: 'https://example.com/header.png',
    headerStatic: 'https://example.com/header.png',
    followersCount: 100,
    followingCount: 50,
    statusesCount: 200,
    lastStatusAt: '2024-01-01',
    emojis: [],
    fields: [],
} as unknown as mastodon.v1.Account;

describe('sessions', () => {
    beforeEach(() => {
        clearAllSessions();
    });

    describe('createSession', () => {
        it('should create a session with correct ID format', () => {
            const session = createSession(
                'https://mastodon.social',
                'access_token_123',
                mockAccount
            );

            expect(session.id).toBe('12345@mastodon.social');
            expect(session.instanceUrl).toBe('https://mastodon.social');
            expect(session.accessToken).toBe('access_token_123');
            expect(session.account.username).toBe('testuser');
            expect(session.createdAt).toBeDefined();
        });
    });

    describe('saveSession and loadSessions', () => {
        it('should save and load sessions correctly', () => {
            const session: Session = {
                id: '12345@mastodon.social',
                instanceUrl: 'https://mastodon.social',
                accessToken: 'token123',
                account: mockAccount,
                createdAt: Date.now(),
            };

            saveSession(session);
            const loaded = loadSessions();

            expect(loaded).toHaveLength(1);
            expect(loaded[0].id).toBe(session.id);
            expect(loaded[0].accessToken).toBe(session.accessToken);
        });

        it('should replace existing session with same ID', () => {
            const session1: Session = {
                id: '12345@mastodon.social',
                instanceUrl: 'https://mastodon.social',
                accessToken: 'old_token',
                account: mockAccount,
                createdAt: Date.now(),
            };

            const session2: Session = {
                ...session1,
                accessToken: 'new_token',
            };

            saveSession(session1);
            saveSession(session2);
            const loaded = loadSessions();

            expect(loaded).toHaveLength(1);
            expect(loaded[0].accessToken).toBe('new_token');
        });

        it('should handle multiple sessions', () => {
            const session1 = createSession('https://mastodon.social', 'token1', mockAccount);
            const session2 = createSession('https://mstdn.jp', 'token2', {
                ...mockAccount,
                id: '67890',
            } as unknown as mastodon.v1.Account);

            saveSession(session1);
            saveSession(session2);
            const loaded = loadSessions();

            expect(loaded).toHaveLength(2);
        });
    });

    describe('getSession', () => {
        it('should return undefined for non-existent session', () => {
            const session = getSession('nonexistent');
            expect(session).toBeUndefined();
        });

        it('should return the correct session by ID', () => {
            const session = createSession('https://mastodon.social', 'token123', mockAccount);
            saveSession(session);

            const retrieved = getSession(session.id);
            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(session.id);
        });
    });

    describe('removeSession', () => {
        it('should remove a session by ID', () => {
            const session = createSession('https://mastodon.social', 'token123', mockAccount);
            saveSession(session);

            expect(loadSessions()).toHaveLength(1);

            removeSession(session.id);

            expect(loadSessions()).toHaveLength(0);
        });

        it('should not affect other sessions when removing one', () => {
            const session1 = createSession('https://mastodon.social', 'token1', mockAccount);
            const session2 = createSession('https://mstdn.jp', 'token2', {
                ...mockAccount,
                id: '67890',
            } as unknown as mastodon.v1.Account);

            saveSession(session1);
            saveSession(session2);

            removeSession(session1.id);
            const remaining = loadSessions();

            expect(remaining).toHaveLength(1);
            expect(remaining[0].id).toBe(session2.id);
        });
    });

    describe('clearAllSessions', () => {
        it('should remove all sessions', () => {
            const session1 = createSession('https://mastodon.social', 'token1', mockAccount);
            const session2 = createSession('https://mstdn.jp', 'token2', {
                ...mockAccount,
                id: '67890',
            } as unknown as mastodon.v1.Account);

            saveSession(session1);
            saveSession(session2);

            expect(loadSessions()).toHaveLength(2);

            clearAllSessions();

            expect(loadSessions()).toHaveLength(0);
        });
    });
});
