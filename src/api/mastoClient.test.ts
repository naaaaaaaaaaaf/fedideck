import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createStatus,
    favouriteStatus,
    unfavouriteStatus,
    reblogStatus,
    unreblogStatus,
    getStatusContext,
    fetchAccount,
    type CreateStatusParams,
    type MastoClient,
} from './mastoClient';

describe('createStatus', () => {
    let mockClient: MastoClient;
    let mockCreate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockCreate = vi.fn();
        mockClient = {
            v1: {
                statuses: {
                    create: mockCreate,
                },
            },
        } as unknown as MastoClient;
    });

    it('creates a status with minimal params', async () => {
        const mockResponse = {
            id: '123',
            content: '<p>Hello world</p>',
            createdAt: '2026-01-20T12:00:00.000Z',
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        const params: CreateStatusParams = {
            status: 'Hello world',
        };

        const result = await createStatus(mockClient, params);

        expect(mockCreate).toHaveBeenCalledWith({
            status: 'Hello world',
            visibility: undefined,
            spoilerText: undefined,
            inReplyToId: undefined,
            sensitive: undefined,
            language: undefined,
        });
        expect(result).toEqual(mockResponse);
    });

    it('creates a status with all params', async () => {
        const mockResponse = { id: '456' };
        mockCreate.mockResolvedValueOnce(mockResponse);

        const params: CreateStatusParams = {
            status: 'Test post',
            visibility: 'private',
            spoilerText: 'CW text',
            inReplyToId: '789',
            sensitive: true,
            language: 'ja',
        };

        await createStatus(mockClient, params);

        expect(mockCreate).toHaveBeenCalledWith({
            status: 'Test post',
            visibility: 'private',
            spoilerText: 'CW text',
            inReplyToId: '789',
            sensitive: true,
            language: 'ja',
        });
    });

    it('creates a status with public visibility', async () => {
        mockCreate.mockResolvedValueOnce({ id: '1' });

        const params: CreateStatusParams = {
            status: 'Public post',
            visibility: 'public',
        };

        await createStatus(mockClient, params);

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'Public post',
                visibility: 'public',
            })
        );
    });

    it('creates a status with unlisted visibility', async () => {
        mockCreate.mockResolvedValueOnce({ id: '2' });

        const params: CreateStatusParams = {
            status: 'Unlisted post',
            visibility: 'unlisted',
        };

        await createStatus(mockClient, params);

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'Unlisted post',
                visibility: 'unlisted',
            })
        );
    });

    it('creates a status with direct visibility', async () => {
        mockCreate.mockResolvedValueOnce({ id: '3' });

        const params: CreateStatusParams = {
            status: '@someone direct message',
            visibility: 'direct',
        };

        await createStatus(mockClient, params);

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                status: '@someone direct message',
                visibility: 'direct',
            })
        );
    });

    it('throws an error when API call fails', async () => {
        const error = new Error('API Error');
        mockCreate.mockRejectedValueOnce(error);

        const params: CreateStatusParams = {
            status: 'Failing post',
        };

        await expect(createStatus(mockClient, params)).rejects.toThrow('API Error');
    });
});

describe('favouriteStatus', () => {
    it('calls favourite endpoint with correct status ID', async () => {
        const mockFavourite = vi.fn().mockResolvedValue({
            id: '123',
            favourited: true,
            favouritesCount: 5,
        });
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        favourite: mockFavourite,
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await favouriteStatus(mockClient, '123');

        expect(mockClient.v1.statuses.$select).toHaveBeenCalledWith('123');
        expect(mockFavourite).toHaveBeenCalled();
        expect(result.favourited).toBe(true);
    });
});

describe('unfavouriteStatus', () => {
    it('calls unfavourite endpoint with correct status ID', async () => {
        const mockUnfavourite = vi.fn().mockResolvedValue({
            id: '123',
            favourited: false,
            favouritesCount: 4,
        });
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        unfavourite: mockUnfavourite,
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await unfavouriteStatus(mockClient, '123');

        expect(mockClient.v1.statuses.$select).toHaveBeenCalledWith('123');
        expect(mockUnfavourite).toHaveBeenCalled();
        expect(result.favourited).toBe(false);
    });
});

describe('reblogStatus', () => {
    it('calls reblog endpoint with correct status ID', async () => {
        const mockReblog = vi.fn().mockResolvedValue({
            id: '456',
            reblogged: true,
            reblogsCount: 10,
        });
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        reblog: mockReblog,
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await reblogStatus(mockClient, '456');

        expect(mockClient.v1.statuses.$select).toHaveBeenCalledWith('456');
        expect(mockReblog).toHaveBeenCalled();
        expect(result.reblogged).toBe(true);
    });
});

describe('unreblogStatus', () => {
    it('calls unreblog endpoint with correct status ID', async () => {
        const mockUnreblog = vi.fn().mockResolvedValue({
            id: '456',
            reblogged: false,
            reblogsCount: 9,
        });
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        unreblog: mockUnreblog,
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await unreblogStatus(mockClient, '456');

        expect(mockClient.v1.statuses.$select).toHaveBeenCalledWith('456');
        expect(mockUnreblog).toHaveBeenCalled();
        expect(result.reblogged).toBe(false);
    });
});

describe('getStatusContext', () => {
    it('fetches ancestors and descendants for a status', async () => {
        const mockContext = {
            ancestors: [
                { id: '1', content: '<p>Parent</p>' },
                { id: '2', content: '<p>Grandparent</p>' },
            ],
            descendants: [
                { id: '4', content: '<p>Reply 1</p>' },
                { id: '5', content: '<p>Reply 2</p>' },
            ],
        };
        const mockContextFetch = vi.fn().mockResolvedValue(mockContext);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        context: {
                            fetch: mockContextFetch,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await getStatusContext(mockClient, '3');

        expect(mockClient.v1.statuses.$select).toHaveBeenCalledWith('3');
        expect(mockContextFetch).toHaveBeenCalled();
        expect(result.ancestors).toHaveLength(2);
        expect(result.descendants).toHaveLength(2);
    });

    it('returns empty arrays when status has no context', async () => {
        const mockContext = {
            ancestors: [],
            descendants: [],
        };
        const mockContextFetch = vi.fn().mockResolvedValue(mockContext);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        context: {
                            fetch: mockContextFetch,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await getStatusContext(mockClient, '123');

        expect(result.ancestors).toEqual([]);
        expect(result.descendants).toEqual([]);
    });

    it('throws an error when API call fails', async () => {
        const mockContextFetch = vi.fn().mockRejectedValue(new Error('API Error'));
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        context: {
                            fetch: mockContextFetch,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        await expect(getStatusContext(mockClient, '123')).rejects.toThrow('API Error');
    });
});

describe('fetchAccount', () => {
    it('fetches account by ID', async () => {
        const mockAccount = {
            id: '123',
            username: 'testuser',
            acct: 'testuser@mastodon.social',
            displayName: 'Test User',
            avatar: 'https://example.com/avatar.png',
            avatarStatic: 'https://example.com/avatar-static.png',
            note: '<p>Bio text</p>',
            followersCount: 100,
            followingCount: 50,
            statusesCount: 200,
        };
        const mockFetch = vi.fn().mockResolvedValue(mockAccount);
        const mockClient = {
            v1: {
                accounts: {
                    $select: vi.fn().mockReturnValue({
                        fetch: mockFetch,
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await fetchAccount(mockClient, '123');

        expect(mockClient.v1.accounts.$select).toHaveBeenCalledWith('123');
        expect(mockFetch).toHaveBeenCalled();
        expect(result.id).toBe('123');
        expect(result.username).toBe('testuser');
    });

    it('throws an error when API call fails', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('Account not found'));
        const mockClient = {
            v1: {
                accounts: {
                    $select: vi.fn().mockReturnValue({
                        fetch: mockFetch,
                    }),
                },
            },
        } as unknown as MastoClient;

        await expect(fetchAccount(mockClient, '999')).rejects.toThrow('Account not found');
    });
});
