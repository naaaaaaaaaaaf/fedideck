import { describe, it, expect } from 'vitest';
import { snakeToCamel, convertKeysToCamelCase } from './snakeToCamel';

describe('snakeToCamel', () => {
    it('should convert snake_case to camelCase', () => {
        expect(snakeToCamel('created_at')).toBe('createdAt');
        expect(snakeToCamel('display_name')).toBe('displayName');
        expect(snakeToCamel('media_attachments')).toBe('mediaAttachments');
        expect(snakeToCamel('in_reply_to_id')).toBe('inReplyToId');
    });

    it('should not change already camelCase strings', () => {
        expect(snakeToCamel('createdAt')).toBe('createdAt');
        expect(snakeToCamel('displayName')).toBe('displayName');
    });

    it('should not change strings without underscores', () => {
        expect(snakeToCamel('id')).toBe('id');
        expect(snakeToCamel('url')).toBe('url');
        expect(snakeToCamel('content')).toBe('content');
    });
});

describe('convertKeysToCamelCase', () => {
    it('should handle null and undefined', () => {
        expect(convertKeysToCamelCase(null)).toBeNull();
        expect(convertKeysToCamelCase(undefined)).toBeUndefined();
    });

    it('should handle primitive values', () => {
        expect(convertKeysToCamelCase('string')).toBe('string');
        expect(convertKeysToCamelCase(123)).toBe(123);
        expect(convertKeysToCamelCase(true)).toBe(true);
    });

    it('should convert simple object keys', () => {
        const input = {
            created_at: '2024-01-01',
            display_name: 'Test User',
            id: '123',
        };

        const result = convertKeysToCamelCase(input);

        expect(result).toEqual({
            createdAt: '2024-01-01',
            displayName: 'Test User',
            id: '123',
        });
    });

    it('should convert nested object keys', () => {
        const input = {
            id: '123',
            account: {
                display_name: 'Test User',
                avatar_static: 'https://example.com/avatar.png',
            },
        };

        const result = convertKeysToCamelCase(input);

        expect(result).toEqual({
            id: '123',
            account: {
                displayName: 'Test User',
                avatarStatic: 'https://example.com/avatar.png',
            },
        });
    });

    it('should convert array of objects', () => {
        const input = {
            media_attachments: [
                { preview_url: 'url1', remote_url: null },
                { preview_url: 'url2', remote_url: 'url3' },
            ],
        };

        const result = convertKeysToCamelCase(input);

        expect(result).toEqual({
            mediaAttachments: [
                { previewUrl: 'url1', remoteUrl: null },
                { previewUrl: 'url2', remoteUrl: 'url3' },
            ],
        });
    });

    it('should handle Mastodon status-like object', () => {
        const input = {
            id: '12345',
            created_at: '2024-01-01T00:00:00.000Z',
            in_reply_to_id: null,
            in_reply_to_account_id: null,
            spoiler_text: '',
            replies_count: 0,
            reblogs_count: 5,
            favourites_count: 10,
            account: {
                id: '1',
                username: 'testuser',
                acct: 'testuser',
                display_name: 'Test User',
                avatar: 'https://example.com/avatar.png',
                avatar_static: 'https://example.com/avatar.png',
                followers_count: 100,
                following_count: 50,
                statuses_count: 200,
            },
            media_attachments: [],
            mentions: [],
            tags: [],
            emojis: [],
        };

        // Cast to unknown first, then to expected camelCase structure
        const result = convertKeysToCamelCase(input) as unknown as {
            createdAt: string;
            inReplyToId: null;
            spoilerText: string;
            repliesCount: number;
            reblogsCount: number;
            favouritesCount: number;
            account: {
                displayName: string;
                avatarStatic: string;
                followersCount: number;
            };
            mediaAttachments: unknown[];
        };

        expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
        expect(result.inReplyToId).toBeNull();
        expect(result.spoilerText).toBe('');
        expect(result.repliesCount).toBe(0);
        expect(result.reblogsCount).toBe(5);
        expect(result.favouritesCount).toBe(10);
        expect(result.account.displayName).toBe('Test User');
        expect(result.account.avatarStatic).toBe('https://example.com/avatar.png');
        expect(result.account.followersCount).toBe(100);
        expect(result.mediaAttachments).toEqual([]);
    });
});
