import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatus, type CreateStatusParams, type MastoClient } from './mastoClient';

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
