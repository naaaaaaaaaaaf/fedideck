import { describe, it, expect } from 'vitest';
import {
    getDisplayStatus,
    getDisplayStatusOrNull,
    hasContentWarning,
    getReblogger,
    hasQuote,
    isFullQuote,
    getQuotedStatus,
    getQuoteState,
    getQuoteStateMessage,
    stripQuoteInline,
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

    describe('hasQuote', () => {
        it('returns false when status has no quote', () => {
            const status = createMockStatus();
            expect(hasQuote(status)).toBe(false);
        });

        it('returns true when status has a quote', () => {
            const quotedStatus = createMockStatus({ id: 'quoted' });
            const status = createMockStatus({
                quote: {
                    state: 'accepted',
                    quotedStatus,
                } as mastodon.v1.Quote,
            });
            expect(hasQuote(status)).toBe(true);
        });

        it('returns true when status has a ShallowQuote', () => {
            const status = createMockStatus({
                quote: {
                    state: 'pending',
                    quotedStatusId: '123',
                } as mastodon.v1.ShallowQuote,
            });
            expect(hasQuote(status)).toBe(true);
        });
    });

    describe('isFullQuote', () => {
        it('returns true for full Quote with quotedStatus', () => {
            const quotedStatus = createMockStatus({ id: 'quoted' });
            const quote = {
                state: 'accepted' as const,
                quotedStatus,
            };
            expect(isFullQuote(quote)).toBe(true);
        });

        it('returns false for ShallowQuote', () => {
            const shallowQuote = {
                state: 'pending' as const,
                quotedStatusId: '123',
            };
            expect(isFullQuote(shallowQuote)).toBe(false);
        });
    });

    describe('getQuotedStatus', () => {
        it('returns null when status has no quote', () => {
            const status = createMockStatus();
            expect(getQuotedStatus(status)).toBeNull();
        });

        it('returns null when quote state is not accepted', () => {
            const status = createMockStatus({
                quote: {
                    state: 'pending',
                    quotedStatusId: '123',
                } as mastodon.v1.ShallowQuote,
            });
            expect(getQuotedStatus(status)).toBeNull();
        });

        it('returns null for ShallowQuote with accepted state', () => {
            const status = createMockStatus({
                quote: {
                    state: 'accepted',
                    quotedStatusId: '123',
                } as mastodon.v1.ShallowQuote,
            });
            expect(getQuotedStatus(status)).toBeNull();
        });

        it('returns quotedStatus for full Quote with accepted state', () => {
            const quotedStatus = createMockStatus({ id: 'quoted' });
            const status = createMockStatus({
                quote: {
                    state: 'accepted',
                    quotedStatus,
                } as mastodon.v1.Quote,
            });
            expect(getQuotedStatus(status)).toBe(quotedStatus);
        });

        it('returns null when quotedStatus is null', () => {
            const status = createMockStatus({
                quote: {
                    state: 'accepted',
                    quotedStatus: null,
                } as mastodon.v1.Quote,
            });
            expect(getQuotedStatus(status)).toBeNull();
        });
    });

    describe('getQuoteState', () => {
        it('returns null when status has no quote', () => {
            const status = createMockStatus();
            expect(getQuoteState(status)).toBeNull();
        });

        it('returns the quote state', () => {
            const states: mastodon.v1.QuoteState[] = [
                'accepted',
                'pending',
                'rejected',
                'revoked',
                'deleted',
                'unauthorized',
                'blocked_account',
                'blocked_domain',
                'muted_account',
            ];
            for (const state of states) {
                const status = createMockStatus({
                    quote: { state } as mastodon.v1.Quote,
                });
                expect(getQuoteState(status)).toBe(state);
            }
        });
    });

    describe('getQuoteStateMessage', () => {
        it('returns null for accepted state', () => {
            expect(getQuoteStateMessage('accepted')).toBeNull();
        });

        it('returns correct message for pending', () => {
            expect(getQuoteStateMessage('pending')).toBe('引用の承認待ち');
        });

        it('returns correct message for rejected', () => {
            expect(getQuoteStateMessage('rejected')).toBe('引用が拒否されました');
        });

        it('returns correct message for revoked', () => {
            expect(getQuoteStateMessage('revoked')).toBe('引用が取り消されました');
        });

        it('returns correct message for deleted', () => {
            expect(getQuoteStateMessage('deleted')).toBe('引用元の投稿が削除されました');
        });

        it('returns correct message for unauthorized', () => {
            expect(getQuoteStateMessage('unauthorized')).toBe('引用する権限がありません');
        });

        it('returns correct message for blocked_account', () => {
            expect(getQuoteStateMessage('blocked_account')).toBe(
                'ブロックしたアカウントの投稿です'
            );
        });

        it('returns correct message for blocked_domain', () => {
            expect(getQuoteStateMessage('blocked_domain')).toBe('ブロックしたドメインの投稿です');
        });

        it('returns correct message for muted_account', () => {
            expect(getQuoteStateMessage('muted_account')).toBe('ミュートしたアカウントの投稿です');
        });
    });

    describe('stripQuoteInline', () => {
        it('returns unchanged HTML when no quote-inline element', () => {
            const html = '<p>Hello world</p>';
            expect(stripQuoteInline(html)).toBe(html);
        });

        it('removes quote-inline element', () => {
            const html =
                '<p>Hello world</p><span class="quote-inline"><a href="https://example.com">Quote</a></span>';
            const result = stripQuoteInline(html);
            expect(result).toBe('<p>Hello world</p>');
        });

        it('removes multiple quote-inline elements', () => {
            const html =
                '<span class="quote-inline">1</span><p>Text</p><span class="quote-inline">2</span>';
            const result = stripQuoteInline(html);
            expect(result).toBe('<p>Text</p>');
        });

        it('handles nested quote-inline elements', () => {
            const html = '<div><span class="quote-inline"><strong>Bold</strong></span></div>';
            const result = stripQuoteInline(html);
            expect(result).toBe('<div></div>');
        });

        it('preserves other classes', () => {
            const html = '<p class="content">Text</p><span class="quote-inline other">Quote</span>';
            const result = stripQuoteInline(html);
            expect(result).toBe('<p class="content">Text</p>');
        });
    });
});
