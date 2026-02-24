/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMediaUpload, type MediaFile } from './useMediaUpload';
import * as mastoClient from '../api/mastoClient';

// Mock dependencies
vi.mock('../api/mastoClient', () => ({
    getClient: vi.fn(() => ({})),
    uploadMedia: vi.fn(),
}));

vi.mock('../api/instanceConfig', () => ({
    getDefaultConfig: vi.fn(() => ({
        maxCharacters: 500,
        maxMediaAttachments: 4,
        supportedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
    })),
}));

describe('useMediaUpload', () => {
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

    const mockInstanceConfig = {
        maxCharacters: 500,
        maxMediaAttachments: 4,
        supportedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'audio/mpeg'],
    };

    const mockOnError = vi.fn();

    const createDefaultProps = (overrides = {}) => {
        const isSubmittingRef = { current: false };
        const isLoadingEditSourceRef = { current: false };
        return {
            accountSession: mockAccountSession as any,
            instanceConfig: mockInstanceConfig,
            isOpen: true,
            showPoll: false,
            isSubmittingRef,
            isLoadingEditSourceRef,
            onError: mockOnError,
            ...overrides,
        };
    };

    const defaultProps = createDefaultProps();

    const createMockFile = (name: string, type: string, content = 'test content'): File => {
        return new File([content], name, { type });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(mastoClient.uploadMedia).mockResolvedValue({ id: 'uploaded-id' } as any);
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe('initial state', () => {
        it('should return empty media files initially', () => {
            const { result } = renderHook(() => useMediaUpload(defaultProps));

            expect(result.current.mediaFiles).toEqual([]);
            expect(result.current.isUploading).toBe(false);
            expect(result.current.hasMedia).toBe(false);
        });
    });

    describe('handleFileSelect', () => {
        it('should add and upload selected files', async () => {
            const file = createMockFile('test.jpg', 'image/jpeg');
            const fileList = {
                length: 1,
                item: () => file,
                0: file,
            } as unknown as FileList;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            act(() => {
                result.current.handleFileSelect({
                    target: { files: fileList, value: 'test' },
                } as any);
            });

            expect(result.current.hasMedia).toBe(true);
            expect(result.current.mediaFiles).toHaveLength(1);
            expect(result.current.mediaFiles[0].uploading).toBe(true);

            await waitFor(() => {
                expect(result.current.isUploading).toBe(false);
            });

            expect(result.current.mediaFiles[0].uploadedId).toBe('uploaded-id');
        });

        it('should reject files when poll is enabled', () => {
            const file = createMockFile('test.jpg', 'image/jpeg');
            const fileList = {
                length: 1,
                item: () => file,
                0: file,
            } as unknown as FileList;

            const { result } = renderHook(() =>
                useMediaUpload({
                    ...defaultProps,
                    showPoll: true,
                })
            );

            act(() => {
                result.current.handleFileSelect({
                    target: { files: fileList },
                } as any);
            });

            expect(result.current.hasMedia).toBe(false);
            expect(mockOnError).toHaveBeenCalledWith('投票とメディアは同時に添付できません');
        });

        it('should reject unsupported MIME types', async () => {
            const file = createMockFile('test.xyz', 'application/xyz');
            const fileList = {
                length: 1,
                item: () => file,
                0: file,
            } as unknown as FileList;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            act(() => {
                result.current.handleFileSelect({
                    target: { files: fileList },
                } as any);
            });

            // Wait for setTimeout to fire
            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalledWith(
                    expect.stringContaining('未対応のファイル形式です')
                );
            });

            expect(result.current.hasMedia).toBe(false);
        });

        it('should enforce max media limit', () => {
            const files = Array(5)
                .fill(null)
                .map((_, i) => createMockFile(`test${i}.jpg`, 'image/jpeg'));
            const fileList = {
                length: 5,
                item: (i: number) => files[i],
                [Symbol.iterator]: function* () {
                    for (const file of files) yield file;
                },
            } as unknown as FileList;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            act(() => {
                result.current.handleFileSelect({
                    target: { files: fileList },
                } as any);
            });

            // Should only add 4 files (max limit)
            expect(result.current.mediaFiles).toHaveLength(4);
        });

        it('should allow only one video file', async () => {
            const file1 = createMockFile('video1.mp4', 'video/mp4');
            const file2 = createMockFile('video2.mp4', 'video/mp4');
            const fileList = {
                length: 2,
                item: (i: number) => [file1, file2][i],
                0: file1,
                1: file2,
            } as unknown as FileList;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            act(() => {
                result.current.handleFileSelect({
                    target: { files: fileList },
                } as any);
            });

            // Wait for setTimeout to fire
            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalledWith('動画は1つのみ添付できます');
            });
        });
    });

    describe('handlePaste', () => {
        it('should handle clipboard paste with images', () => {
            const file = createMockFile('clipboard.png', 'image/png');
            const clipboardEvent = {
                clipboardData: {
                    items: [
                        {
                            kind: 'file',
                            type: 'image/png',
                            getAsFile: () => file,
                        },
                    ],
                    files: [] as File[],
                },
            } as any;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            let handled: boolean = false;
            act(() => {
                handled = result.current.handlePaste(clipboardEvent);
            });

            expect(handled).toBe(true);
            expect(result.current.hasMedia).toBe(true);
        });

        it('should return false for non-image paste', () => {
            const clipboardEvent = {
                clipboardData: {
                    items: [
                        {
                            kind: 'string',
                            type: 'text/plain',
                            getAsFile: () => null,
                        },
                    ],
                    files: [] as File[],
                },
            } as any;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            let handled: boolean = false;
            act(() => {
                handled = result.current.handlePaste(clipboardEvent);
            });

            expect(handled).toBe(false);
            expect(result.current.hasMedia).toBe(false);
        });

        it('should filter clipboard to images only', () => {
            const imageFile = createMockFile('image.png', 'image/png');
            const textFile = createMockFile('text.txt', 'text/plain');
            const clipboardEvent = {
                clipboardData: {
                    items: [
                        { kind: 'file', type: 'image/png', getAsFile: () => imageFile },
                        { kind: 'file', type: 'text/plain', getAsFile: () => textFile },
                    ],
                    files: [] as File[],
                },
            } as any;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            act(() => {
                result.current.handlePaste(clipboardEvent);
            });

            // Should only add the image file
            expect(result.current.mediaFiles).toHaveLength(1);
        });
    });

    describe('removeMedia', () => {
        it('should remove media and revoke object URL', async () => {
            const file = createMockFile('test.jpg', 'image/jpeg');
            const fileList = {
                length: 1,
                item: () => file,
                0: file,
            } as unknown as FileList;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            act(() => {
                result.current.handleFileSelect({
                    target: { files: fileList },
                } as any);
            });

            const localId = result.current.mediaFiles[0].localId;
            const previewUrl = result.current.mediaFiles[0].preview;

            // Spy on URL.revokeObjectURL
            const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

            act(() => {
                result.current.removeMedia(localId);
            });

            expect(result.current.hasMedia).toBe(false);
            expect(revokeSpy).toHaveBeenCalledWith(previewUrl);
        });

        it('should not revoke URL for existing media', () => {
            const existingMedia: MediaFile = {
                localId: 'existing-1',
                preview: 'https://example.com/media.png',
                uploading: false,
                uploadedId: 'server-id',
                altText: '',
                isExisting: true,
                kind: 'image',
            };

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            act(() => {
                result.current.setMediaFiles([existingMedia]);
            });

            const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

            act(() => {
                result.current.removeMedia('existing-1');
            });

            expect(revokeSpy).not.toHaveBeenCalled();
        });
    });

    describe('updateAltText', () => {
        it('should update alt text for media', async () => {
            const file = createMockFile('test.jpg', 'image/jpeg');
            const fileList = {
                length: 1,
                item: () => file,
                0: file,
            } as unknown as FileList;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            act(() => {
                result.current.handleFileSelect({
                    target: { files: fileList },
                } as any);
            });

            await waitFor(() => {
                expect(result.current.isUploading).toBe(false);
            });

            const localId = result.current.mediaFiles[0].localId;

            act(() => {
                result.current.updateAltText(localId, 'New alt text');
            });

            expect(result.current.mediaFiles[0].altText).toBe('New alt text');
        });
    });

    describe('clearMedia', () => {
        it('should clear all media and revoke URLs', async () => {
            const file = createMockFile('test.jpg', 'image/jpeg');
            const fileList = {
                length: 1,
                item: () => file,
                0: file,
            } as unknown as FileList;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            act(() => {
                result.current.handleFileSelect({
                    target: { files: fileList },
                } as any);
            });

            const previewUrl = result.current.mediaFiles[0].preview;
            const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

            act(() => {
                result.current.clearMedia();
            });

            expect(result.current.hasMedia).toBe(false);
            expect(revokeSpy).toHaveBeenCalledWith(previewUrl);
        });
    });

    describe('upload error handling', () => {
        it('should set error on upload failure', async () => {
            vi.mocked(mastoClient.uploadMedia).mockRejectedValue(new Error('Upload failed'));

            const file = createMockFile('test.jpg', 'image/jpeg');
            const fileList = {
                length: 1,
                item: () => file,
                0: file,
            } as unknown as FileList;

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            act(() => {
                result.current.handleFileSelect({
                    target: { files: fileList },
                } as any);
            });

            await waitFor(() => {
                expect(result.current.isUploading).toBe(false);
            });

            expect(result.current.mediaFiles[0].error).toBe('Upload failed');
        });
    });

    describe('modal close behavior', () => {
        it('should clear media when modal closes', async () => {
            const file = createMockFile('test.jpg', 'image/jpeg');
            const fileList = {
                length: 1,
                item: () => file,
                0: file,
            } as unknown as FileList;

            const { result, rerender } = renderHook((props) => useMediaUpload(props), {
                initialProps: defaultProps,
            });

            act(() => {
                result.current.handleFileSelect({
                    target: { files: fileList },
                } as any);
            });

            expect(result.current.hasMedia).toBe(true);

            // Close modal
            rerender({
                ...defaultProps,
                isOpen: false,
            });

            expect(result.current.hasMedia).toBe(false);
            expect(result.current.mediaFiles).toEqual([]);
        });
    });

    describe('audio/video validation', () => {
        it('should reject audio mixed with other media', async () => {
            const imageFile = createMockFile('image.jpg', 'image/jpeg');
            const audioFile = createMockFile('audio.mp3', 'audio/mpeg');

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            // First add an image
            const imageFileList = {
                length: 1,
                item: () => imageFile,
                0: imageFile,
            } as unknown as FileList;

            act(() => {
                result.current.handleFileSelect({
                    target: { files: imageFileList },
                } as any);
            });

            // Wait for upload to complete (not just start)
            await waitFor(() => {
                expect(result.current.isUploading).toBe(false);
            });
            expect(result.current.hasMedia).toBe(true);

            // Then try to add audio
            const audioFileList = {
                length: 1,
                item: () => audioFile,
                0: audioFile,
            } as unknown as FileList;

            act(() => {
                result.current.handleFileSelect({
                    target: { files: audioFileList },
                } as any);
            });

            // Wait for setTimeout to fire
            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalledWith(
                    '音声は他のメディアと同時に添付できません'
                );
            });
        });

        it('should reject video mixed with existing media', async () => {
            const imageFile = createMockFile('image.jpg', 'image/jpeg');
            const videoFile = createMockFile('video.mp4', 'video/mp4');

            const { result } = renderHook(() => useMediaUpload(defaultProps));

            // First add an image
            const imageFileList = {
                length: 1,
                item: () => imageFile,
                0: imageFile,
            } as unknown as FileList;

            act(() => {
                result.current.handleFileSelect({
                    target: { files: imageFileList },
                } as any);
            });

            // Wait for upload to complete (not just start)
            await waitFor(() => {
                expect(result.current.isUploading).toBe(false);
            });
            expect(result.current.hasMedia).toBe(true);

            // Then try to add video
            const videoFileList = {
                length: 1,
                item: () => videoFile,
                0: videoFile,
            } as unknown as FileList;

            act(() => {
                result.current.handleFileSelect({
                    target: { files: videoFileList },
                } as any);
            });

            // Wait for setTimeout to fire
            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalledWith(
                    '動画は他のメディアと同時に添付できません'
                );
            });
        });
    });

    describe('setMediaFiles', () => {
        it('should allow direct state updates', () => {
            const { result } = renderHook(() => useMediaUpload(defaultProps));

            const newMedia: MediaFile = {
                localId: 'test-id',
                preview: 'https://example.com/preview.png',
                uploading: false,
                uploadedId: 'server-id',
                altText: 'Test alt',
                isExisting: true,
                kind: 'image',
            };

            act(() => {
                result.current.setMediaFiles([newMedia]);
            });

            expect(result.current.mediaFiles).toEqual([newMedia]);
        });
    });
});
