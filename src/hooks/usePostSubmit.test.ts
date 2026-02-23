import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePostSubmit, type PostSubmitState, type Visibility } from './usePostSubmit';
import type { MediaFile } from './useMediaUpload';
import * as mastoClient from '../api/mastoClient';

// Mock dependencies
vi.mock('../api/mastoClient', () => ({
    getClient: vi.fn(() => ({})),
    createStatus: vi.fn(),
    editStatus: vi.fn(),
    waitForMediaReady: vi.fn(),
    updateMediaDescription: vi.fn(),
}));

describe('usePostSubmit', () => {
    const mockAccountSession = {
        id: 'test-account-id',
        instanceUrl: 'https://example.com',
        accessToken: 'test-token',
        account: {
            id: '123',
            username: 'testuser',
            displayName: 'Test User',
            url: 'https://example.com/@testuser',
            avatar: 'https://example.com/avatar.png',
        },
    };

    const mockEditTarget = {
        status: {
            id: 'status-123',
            visibility: 'public',
            sensitive: false,
            mediaAttachments: [],
        },
        accountSessionId: 'test-account-id',
    };

    const mockReplyToStatus = {
        id: 'reply-123',
        acct: 'someone@example.com',
        displayName: 'Someone',
        content: '<p>Original post</p>',
        avatar: 'https://example.com/avatar.png',
    };

    const defaultState: PostSubmitState = {
        content: 'Test post content',
        visibility: 'public' as Visibility,
        showCW: false,
        cwText: '',
        isSensitive: false,
        showPoll: false,
        pollOptions: [],
        pollExpiresIn: 86400,
        pollMultiple: false,
        mediaFiles: [],
    };

    const mockOnSuccess = vi.fn();
    const mockOnStatusEdited = vi.fn();
    const mockOnError = vi.fn();

    const defaultProps = {
        accountSession: mockAccountSession as any,
        isOpen: true,
        isEditMode: false,
        editTarget: undefined,
        replyToStatus: undefined,
        state: defaultState,
        instanceConfig: { maxCharacters: 500 },
        isUploading: false,
        isLoadingEditSource: false,
        onSuccess: mockOnSuccess,
        onStatusEdited: mockOnStatusEdited,
        onError: mockOnError,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(mastoClient.createStatus).mockResolvedValue({} as any);
        vi.mocked(mastoClient.editStatus).mockResolvedValue({ id: 'edited' } as any);
        vi.mocked(mastoClient.waitForMediaReady).mockResolvedValue(undefined);
        vi.mocked(mastoClient.updateMediaDescription).mockResolvedValue({} as any);
    });

    describe('initial state', () => {
        it('should return correct initial values', () => {
            const { result } = renderHook(() => usePostSubmit(defaultProps));

            expect(result.current.isSubmitting).toBe(false);
            expect(result.current.canSubmit).toBe(true);
            expect(result.current.remainingChars).toBe(500 - 'Test post content'.length);
        });
    });

    describe('canSubmit validation', () => {
        it('should be false when content is empty and no media/poll', () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, content: '' },
                })
            );

            expect(result.current.canSubmit).toBe(false);
        });

        it('should be true with media even when content is empty', () => {
            const mediaFiles: MediaFile[] = [
                {
                    localId: 'media-1',
                    preview: 'https://example.com/media.png',
                    uploading: false,
                    uploadedId: 'server-id',
                    altText: '',
                },
            ];

            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, content: '', mediaFiles },
                })
            );

            expect(result.current.canSubmit).toBe(true);
        });

        it('should be false when uploading media', () => {
            const mediaFiles: MediaFile[] = [
                {
                    localId: 'media-1',
                    preview: 'blob:test',
                    uploading: true,
                    altText: '',
                },
            ];

            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, mediaFiles },
                    isUploading: true,
                })
            );

            expect(result.current.canSubmit).toBe(false);
        });

        it('should be false when over character limit', () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, content: 'a'.repeat(600) },
                    instanceConfig: { maxCharacters: 500 },
                })
            );

            expect(result.current.canSubmit).toBe(false);
            expect(result.current.remainingChars).toBe(-100);
        });

        it('should be false when account session is null', () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    accountSession: null,
                })
            );

            expect(result.current.canSubmit).toBe(false);
        });

        it('should be true with poll when valid', () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: {
                        ...defaultState,
                        content: '',
                        showPoll: true,
                        pollOptions: [
                            { id: '1', text: 'Option 1' },
                            { id: '2', text: 'Option 2' },
                        ],
                    },
                })
            );

            expect(result.current.canSubmit).toBe(true);
        });

        it('should be false with poll when less than 2 options', () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: {
                        ...defaultState,
                        content: '',
                        showPoll: true,
                        pollOptions: [{ id: '1', text: 'Option 1' }],
                    },
                })
            );

            expect(result.current.canSubmit).toBe(false);
        });
    });

    describe('handleSubmit - create mode', () => {
        it('should create status with content', async () => {
            const { result } = renderHook(() => usePostSubmit(defaultProps));

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.createStatus).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    status: 'Test post content',
                    visibility: 'public',
                })
            );
            expect(mockOnSuccess).toHaveBeenCalled();
        });

        it('should include CW when enabled', async () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, showCW: true, cwText: 'Warning content' },
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.createStatus).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    spoilerText: 'Warning content',
                })
            );
        });

        it('should include reply target when replying', async () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    replyToStatus: mockReplyToStatus as any,
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.createStatus).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    inReplyToId: 'reply-123',
                })
            );
        });

        it('should include media IDs when media is uploaded', async () => {
            const mediaFiles: MediaFile[] = [
                {
                    localId: 'media-1',
                    preview: 'https://example.com/media.png',
                    uploading: false,
                    uploadedId: 'server-id',
                    altText: 'Alt text',
                },
            ];

            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, mediaFiles },
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.createStatus).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    mediaIds: ['server-id'],
                })
            );
            expect(mastoClient.updateMediaDescription).toHaveBeenCalledWith(
                expect.anything(),
                'server-id',
                'Alt text'
            );
        });

        it('should include poll when enabled', async () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: {
                        ...defaultState,
                        showPoll: true,
                        pollOptions: [
                            { id: '1', text: 'Option A' },
                            { id: '2', text: 'Option B' },
                        ],
                        pollExpiresIn: 3600,
                        pollMultiple: true,
                    },
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.createStatus).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    poll: {
                        options: ['Option A', 'Option B'],
                        expiresIn: 3600,
                        multiple: true,
                    },
                })
            );
        });

        it('should call onError on failure', async () => {
            vi.mocked(mastoClient.createStatus).mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => usePostSubmit(defaultProps));

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mockOnError).toHaveBeenCalledWith('Network error');
            expect(mockOnSuccess).not.toHaveBeenCalled();
        });
    });

    describe('handleSubmit - edit mode', () => {
        it('should edit status instead of creating', async () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    isEditMode: true,
                    editTarget: mockEditTarget as any,
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.editStatus).toHaveBeenCalledWith(
                expect.anything(),
                'status-123',
                expect.objectContaining({
                    status: 'Test post content',
                })
            );
            expect(mastoClient.createStatus).not.toHaveBeenCalled();
            expect(mockOnStatusEdited).toHaveBeenCalled();
            expect(mockOnSuccess).toHaveBeenCalled();
        });

        it('should clear media in edit mode when no media attached', async () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    isEditMode: true,
                    editTarget: mockEditTarget as any,
                    state: { ...defaultState, mediaFiles: [] },
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.editStatus).toHaveBeenCalledWith(
                expect.anything(),
                'status-123',
                expect.objectContaining({
                    mediaIds: [],
                })
            );
        });

        it('should include mediaAttributes for alt text in edit mode', async () => {
            const mediaFiles: MediaFile[] = [
                {
                    localId: 'media-1',
                    preview: 'https://example.com/media.png',
                    uploading: false,
                    uploadedId: 'server-id',
                    altText: 'Updated alt text',
                    isExisting: true,
                    kind: 'image',
                },
            ];

            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    isEditMode: true,
                    editTarget: mockEditTarget as any,
                    state: { ...defaultState, mediaFiles },
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.editStatus).toHaveBeenCalledWith(
                expect.anything(),
                'status-123',
                expect.objectContaining({
                    mediaIds: ['server-id'],
                    mediaAttributes: [{ id: 'server-id', description: 'Updated alt text' }],
                })
            );
        });
    });

    describe('media processing', () => {
        it('should wait for video processing before submit', async () => {
            const mediaFiles: MediaFile[] = [
                {
                    localId: 'media-1',
                    file: new File(['video'], 'video.mp4', { type: 'video/mp4' }),
                    preview: 'blob:test',
                    uploading: false,
                    uploadedId: 'video-id',
                    altText: '',
                },
            ];

            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, mediaFiles },
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.waitForMediaReady).toHaveBeenCalledWith(
                expect.anything(),
                'video-id'
            );
        });

        it('should wait for audio processing before submit', async () => {
            const mediaFiles: MediaFile[] = [
                {
                    localId: 'media-1',
                    file: new File(['audio'], 'audio.mp3', { type: 'audio/mpeg' }),
                    preview: 'blob:test',
                    uploading: false,
                    uploadedId: 'audio-id',
                    altText: '',
                },
            ];

            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, mediaFiles },
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.waitForMediaReady).toHaveBeenCalledWith(
                expect.anything(),
                'audio-id'
            );
        });

        it('should not wait for image processing', async () => {
            const mediaFiles: MediaFile[] = [
                {
                    localId: 'media-1',
                    file: new File(['image'], 'image.jpg', { type: 'image/jpeg' }),
                    preview: 'blob:test',
                    uploading: false,
                    uploadedId: 'image-id',
                    altText: '',
                },
            ];

            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, mediaFiles },
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mastoClient.waitForMediaReady).not.toHaveBeenCalled();
        });

        it('should handle media processing timeout', async () => {
            vi.mocked(mastoClient.waitForMediaReady).mockRejectedValue(new Error('Timeout'));

            const mediaFiles: MediaFile[] = [
                {
                    localId: 'media-1',
                    file: new File(['video'], 'video.mp4', { type: 'video/mp4' }),
                    preview: 'blob:test',
                    uploading: false,
                    uploadedId: 'video-id',
                    altText: '',
                },
            ];

            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, mediaFiles },
                })
            );

            await act(async () => {
                await result.current.handleSubmit();
            });

            expect(mockOnError).toHaveBeenCalledWith('メディアの処理が完了しませんでした');
            expect(mockOnSuccess).not.toHaveBeenCalled();
        });
    });

    describe('remainingChars', () => {
        it('should calculate remaining characters correctly', () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    state: { ...defaultState, content: 'Short' },
                    instanceConfig: { maxCharacters: 500 },
                })
            );

            expect(result.current.remainingChars).toBe(495);
        });

        it('should use default 500 when instanceConfig is null', () => {
            const { result } = renderHook(() =>
                usePostSubmit({
                    ...defaultProps,
                    instanceConfig: null,
                })
            );

            expect(result.current.remainingChars).toBe(500 - 'Test post content'.length);
        });
    });
});
