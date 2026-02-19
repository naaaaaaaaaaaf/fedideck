import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createStatus,
    favouriteStatus,
    unfavouriteStatus,
    reblogStatus,
    unreblogStatus,
    deleteStatus,
    getStatusContext,
    fetchAccount,
    waitForMediaReady,
    getStatusSource,
    editStatus,
    votePoll,
    fetchPoll,
    type CreateStatusParams,
    type EditStatusParams,
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

describe('waitForMediaReady', () => {
    it('returns when media.url is populated within timeout', async () => {
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({ url: null }) // First poll: not ready
            .mockResolvedValueOnce({ url: null }) // Second poll: not ready
            .mockResolvedValueOnce({ url: 'https://example.com/media.mp3' }); // Third poll: ready
        const mockClient = {
            v1: {
                media: {
                    $select: vi.fn().mockReturnValue({
                        fetch: mockFetch,
                    }),
                },
            },
        } as unknown as MastoClient;

        // Use short poll interval (1ms) for fast testing
        await waitForMediaReady(mockClient, 'media-123', 10000, 1);

        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws timeout error when media never becomes ready', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ url: null });
        const mockClient = {
            v1: {
                media: {
                    $select: vi.fn().mockReturnValue({
                        fetch: mockFetch,
                    }),
                },
            },
        } as unknown as MastoClient;

        // Use short timeout and poll interval for fast testing
        await expect(waitForMediaReady(mockClient, 'media-456', 10, 1)).rejects.toThrow(
            'メディア処理がタイムアウトしました (mediaId: media-456)'
        );
    });

    it('checks media status one final time after deadline expires', async () => {
        let callCount = 0;
        const mockFetch = vi.fn().mockImplementation(async () => {
            callCount++;
            // Always return null to ensure timeout
            return Promise.resolve({ url: null });
        });
        const mockClient = {
            v1: {
                media: {
                    $select: vi.fn().mockReturnValue({
                        fetch: mockFetch,
                    }),
                },
            },
        } as unknown as MastoClient;

        // Use short timeout and poll interval for fast testing
        await expect(waitForMediaReady(mockClient, 'media-final-check', 10, 1)).rejects.toThrow(
            'メディア処理がタイムアウトしました (mediaId: media-final-check)'
        );

        // The function should have polled at least once before throwing
        expect(callCount).toBeGreaterThanOrEqual(1);
    });
});

describe('deleteStatus', () => {
    it('calls remove endpoint with correct status ID', async () => {
        const mockRemove = vi.fn().mockResolvedValue({
            id: '123',
            content: '<p>Deleted post</p>',
        });
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        remove: mockRemove,
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await deleteStatus(mockClient, '123');

        expect(mockClient.v1.statuses.$select).toHaveBeenCalledWith('123');
        expect(mockRemove).toHaveBeenCalled();
        expect(result.id).toBe('123');
    });

    it('throws 404 error when status not found', async () => {
        const error = new Error('Record not found');
        (error as Error & { statusCode?: number }).statusCode = 404;
        const mockRemove = vi.fn().mockRejectedValue(error);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        remove: mockRemove,
                    }),
                },
            },
        } as unknown as MastoClient;

        await expect(deleteStatus(mockClient, 'nonexistent')).rejects.toThrow('Record not found');
    });

    it('throws 403 error when not authorized to delete', async () => {
        const error = new Error('This action is not allowed');
        (error as Error & { statusCode?: number }).statusCode = 403;
        const mockRemove = vi.fn().mockRejectedValue(error);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        remove: mockRemove,
                    }),
                },
            },
        } as unknown as MastoClient;

        await expect(deleteStatus(mockClient, '456')).rejects.toThrow('This action is not allowed');
    });
});

describe('getStatusSource', () => {
    it('fetches status source with raw text', async () => {
        const mockSource = {
            id: '123',
            text: 'Raw text without HTML',
            spoilerText: 'CW text',
        };
        const mockSourceFetch = vi.fn().mockResolvedValue(mockSource);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        source: {
                            fetch: mockSourceFetch,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await getStatusSource(mockClient, '123');

        expect(mockClient.v1.statuses.$select).toHaveBeenCalledWith('123');
        expect(mockSourceFetch).toHaveBeenCalled();
        expect(result.id).toBe('123');
        expect(result.text).toBe('Raw text without HTML');
        expect(result.spoilerText).toBe('CW text');
    });

    it('returns empty text and spoilerText for empty status', async () => {
        const mockSource = {
            id: '456',
            text: '',
            spoilerText: '',
        };
        const mockSourceFetch = vi.fn().mockResolvedValue(mockSource);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        source: {
                            fetch: mockSourceFetch,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await getStatusSource(mockClient, '456');

        expect(result.text).toBe('');
        expect(result.spoilerText).toBe('');
    });

    it('throws error when status not found', async () => {
        const mockSourceFetch = vi.fn().mockRejectedValue(new Error('Record not found'));
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        source: {
                            fetch: mockSourceFetch,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        await expect(getStatusSource(mockClient, 'nonexistent')).rejects.toThrow(
            'Record not found'
        );
    });

    it('throws error when not authorized to view source', async () => {
        const error = new Error('This action is not allowed');
        (error as Error & { statusCode?: number }).statusCode = 403;
        const mockSourceFetch = vi.fn().mockRejectedValue(error);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        source: {
                            fetch: mockSourceFetch,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        await expect(getStatusSource(mockClient, '789')).rejects.toThrow(
            'This action is not allowed'
        );
    });
});

describe('editStatus', () => {
    it('edits a status with minimal params', async () => {
        const mockResponse = {
            id: '123',
            content: '<p>Edited content</p>',
            text: 'Edited content',
        };
        const mockUpdate = vi.fn().mockResolvedValue(mockResponse);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        update: mockUpdate,
                    }),
                },
            },
        } as unknown as MastoClient;

        const params: EditStatusParams = {
            status: 'Edited content',
        };

        const result = await editStatus(mockClient, '123', params);

        expect(mockClient.v1.statuses.$select).toHaveBeenCalledWith('123');
        expect(mockUpdate).toHaveBeenCalledWith({
            status: 'Edited content',
        });
        expect(result.id).toBe('123');
    });

    it('edits a status with all params', async () => {
        const mockResponse = {
            id: '123',
            content: '<p>Full edit</p>',
            spoilerText: 'Updated CW',
            sensitive: true,
        };
        const mockUpdate = vi.fn().mockResolvedValue(mockResponse);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        update: mockUpdate,
                    }),
                },
            },
        } as unknown as MastoClient;

        const params: EditStatusParams = {
            status: 'Full edit',
            spoilerText: 'Updated CW',
            sensitive: true,
            language: 'en',
            mediaIds: ['media1', 'media2'],
            mediaAttributes: [
                { id: 'media1', description: 'Alt text 1' },
                { id: 'media2', description: 'Alt text 2' },
            ],
        };

        const result = await editStatus(mockClient, '123', params);

        expect(mockUpdate).toHaveBeenCalledWith({
            status: 'Full edit',
            spoilerText: 'Updated CW',
            sensitive: true,
            language: 'en',
            mediaIds: ['media1', 'media2'],
            mediaAttributes: [
                { id: 'media1', description: 'Alt text 1' },
                { id: 'media2', description: 'Alt text 2' },
            ],
        });
        expect(result.sensitive).toBe(true);
    });

    it('edits spoiler text only', async () => {
        const mockResponse = {
            id: '123',
            content: '<p>Original content</p>',
            spoilerText: 'New CW',
        };
        const mockUpdate = vi.fn().mockResolvedValue(mockResponse);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        update: mockUpdate,
                    }),
                },
            },
        } as unknown as MastoClient;

        const params: EditStatusParams = {
            status: 'Original content',
            spoilerText: 'New CW',
        };

        await editStatus(mockClient, '123', params);

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'Original content',
                spoilerText: 'New CW',
            })
        );
    });

    it('edits media descriptions', async () => {
        const mockResponse = {
            id: '123',
            mediaAttachments: [{ id: 'media1', description: 'Updated description' }],
        };
        const mockUpdate = vi.fn().mockResolvedValue(mockResponse);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        update: mockUpdate,
                    }),
                },
            },
        } as unknown as MastoClient;

        const params: EditStatusParams = {
            status: 'Post with media',
            mediaIds: ['media1'],
            mediaAttributes: [{ id: 'media1', description: 'Updated description' }],
        };

        await editStatus(mockClient, '123', params);

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                mediaIds: ['media1'],
                mediaAttributes: [{ id: 'media1', description: 'Updated description' }],
            })
        );
    });

    it('throws error when not authorized to edit', async () => {
        const error = new Error('This action is not allowed');
        (error as Error & { statusCode?: number }).statusCode = 403;
        const mockUpdate = vi.fn().mockRejectedValue(error);
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        update: mockUpdate,
                    }),
                },
            },
        } as unknown as MastoClient;

        const params: EditStatusParams = {
            status: 'Unauthorized edit',
        };

        await expect(editStatus(mockClient, '456', params)).rejects.toThrow(
            'This action is not allowed'
        );
    });

    it('throws error when status not found', async () => {
        const mockUpdate = vi.fn().mockRejectedValue(new Error('Record not found'));
        const mockClient = {
            v1: {
                statuses: {
                    $select: vi.fn().mockReturnValue({
                        update: mockUpdate,
                    }),
                },
            },
        } as unknown as MastoClient;

        const params: EditStatusParams = {
            status: 'Edit nonexistent',
        };

        await expect(editStatus(mockClient, 'nonexistent', params)).rejects.toThrow(
            'Record not found'
        );
    });
});

describe('votePoll', () => {
    it('votes with single choice', async () => {
        const mockPoll = {
            id: 'poll-123',
            expired: false,
            multiple: false,
            votesCount: 5,
            options: [
                { title: 'Option 1', votesCount: 3 },
                { title: 'Option 2', votesCount: 2 },
            ],
            voted: true,
            ownVotes: [0],
        };
        const mockCreate = vi.fn().mockResolvedValue(mockPoll);
        const mockClient = {
            v1: {
                polls: {
                    $select: vi.fn().mockReturnValue({
                        votes: {
                            create: mockCreate,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await votePoll(mockClient, 'poll-123', [0]);

        expect(mockClient.v1.polls.$select).toHaveBeenCalledWith('poll-123');
        expect(mockCreate).toHaveBeenCalledWith({ choices: [0] });
        expect(result.voted).toBe(true);
        expect(result.ownVotes).toEqual([0]);
    });

    it('votes with multiple choices', async () => {
        const mockPoll = {
            id: 'poll-456',
            expired: false,
            multiple: true,
            votesCount: 10,
            options: [
                { title: 'Option A', votesCount: 4 },
                { title: 'Option B', votesCount: 3 },
                { title: 'Option C', votesCount: 3 },
            ],
            voted: true,
            ownVotes: [0, 2],
        };
        const mockCreate = vi.fn().mockResolvedValue(mockPoll);
        const mockClient = {
            v1: {
                polls: {
                    $select: vi.fn().mockReturnValue({
                        votes: {
                            create: mockCreate,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await votePoll(mockClient, 'poll-456', [0, 2]);

        expect(mockClient.v1.polls.$select).toHaveBeenCalledWith('poll-456');
        expect(mockCreate).toHaveBeenCalledWith({ choices: [0, 2] });
        expect(result.ownVotes).toEqual([0, 2]);
    });

    it('throws error when poll not found', async () => {
        const mockCreate = vi.fn().mockRejectedValue(new Error('Record not found'));
        const mockClient = {
            v1: {
                polls: {
                    $select: vi.fn().mockReturnValue({
                        votes: {
                            create: mockCreate,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        await expect(votePoll(mockClient, 'nonexistent', [0])).rejects.toThrow('Record not found');
    });

    it('throws error when poll is expired', async () => {
        const mockCreate = vi.fn().mockRejectedValue(new Error('Poll is expired'));
        const mockClient = {
            v1: {
                polls: {
                    $select: vi.fn().mockReturnValue({
                        votes: {
                            create: mockCreate,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        await expect(votePoll(mockClient, 'expired-poll', [0])).rejects.toThrow('Poll is expired');
    });

    it('throws error when already voted', async () => {
        const mockCreate = vi.fn().mockRejectedValue(new Error('You have already voted'));
        const mockClient = {
            v1: {
                polls: {
                    $select: vi.fn().mockReturnValue({
                        votes: {
                            create: mockCreate,
                        },
                    }),
                },
            },
        } as unknown as MastoClient;

        await expect(votePoll(mockClient, 'voted-poll', [1])).rejects.toThrow(
            'You have already voted'
        );
    });
});

describe('fetchPoll', () => {
    it('fetches poll by ID', async () => {
        const mockPoll = {
            id: 'poll-123',
            expired: false,
            multiple: false,
            votesCount: 10,
            options: [
                { title: 'Option 1', votesCount: 6 },
                { title: 'Option 2', votesCount: 4 },
            ],
            voted: false,
            ownVotes: null,
        };
        const mockFetch = vi.fn().mockResolvedValue(mockPoll);
        const mockClient = {
            v1: {
                polls: {
                    $select: vi.fn().mockReturnValue({
                        fetch: mockFetch,
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await fetchPoll(mockClient, 'poll-123');

        expect(mockClient.v1.polls.$select).toHaveBeenCalledWith('poll-123');
        expect(mockFetch).toHaveBeenCalled();
        expect(result.id).toBe('poll-123');
        expect(result.votesCount).toBe(10);
    });

    it('fetches poll with vote results', async () => {
        const mockPoll = {
            id: 'poll-456',
            expired: false,
            multiple: true,
            votesCount: 25,
            options: [
                { title: 'Option A', votesCount: 10 },
                { title: 'Option B', votesCount: 8 },
                { title: 'Option C', votesCount: 7 },
            ],
            voted: true,
            ownVotes: [0, 2],
        };
        const mockFetch = vi.fn().mockResolvedValue(mockPoll);
        const mockClient = {
            v1: {
                polls: {
                    $select: vi.fn().mockReturnValue({
                        fetch: mockFetch,
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await fetchPoll(mockClient, 'poll-456');

        expect(result.voted).toBe(true);
        expect(result.ownVotes).toEqual([0, 2]);
        expect(result.options[0].votesCount).toBe(10);
    });

    it('fetches expired poll', async () => {
        const mockPoll = {
            id: 'poll-789',
            expired: true,
            multiple: false,
            votesCount: 100,
            options: [
                { title: 'Yes', votesCount: 60 },
                { title: 'No', votesCount: 40 },
            ],
            voted: true,
            ownVotes: [0],
        };
        const mockFetch = vi.fn().mockResolvedValue(mockPoll);
        const mockClient = {
            v1: {
                polls: {
                    $select: vi.fn().mockReturnValue({
                        fetch: mockFetch,
                    }),
                },
            },
        } as unknown as MastoClient;

        const result = await fetchPoll(mockClient, 'poll-789');

        expect(result.expired).toBe(true);
    });

    it('throws error when poll not found', async () => {
        const mockFetch = vi.fn().mockRejectedValue(new Error('Record not found'));
        const mockClient = {
            v1: {
                polls: {
                    $select: vi.fn().mockReturnValue({
                        fetch: mockFetch,
                    }),
                },
            },
        } as unknown as MastoClient;

        await expect(fetchPoll(mockClient, 'nonexistent')).rejects.toThrow('Record not found');
    });
});
