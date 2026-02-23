import { useState, useEffect, useRef, useCallback } from 'react';
import { getClient, uploadMedia, type AccountSession } from '../api/mastoClient';
import { getDefaultConfig, type InstanceConfig } from '../api/instanceConfig';

/**
 * Media file representation for compose
 */
export interface MediaFile {
    localId: string;
    file?: File;
    preview: string;
    uploading: boolean;
    uploadedId?: string;
    error?: string;
    altText: string;
    isExisting?: boolean;
    kind?: 'image' | 'video' | 'audio' | 'gifv' | 'unknown';
}

interface UseMediaUploadOptions {
    accountSession: AccountSession | null | undefined;
    instanceConfig: InstanceConfig | null;
    isOpen: boolean;
    showPoll: boolean;
    isSubmitting: boolean;
    isLoadingEditSource: boolean;
    onError: (error: string) => void;
}

interface UseMediaUploadReturn {
    mediaFiles: MediaFile[];
    isUploading: boolean;
    hasMedia: boolean;
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handlePaste: (e: React.ClipboardEvent) => boolean;
    removeMedia: (localId: string) => void;
    updateAltText: (localId: string, altText: string) => void;
    clearMedia: () => void;
    setMediaFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>;
}

/**
 * Robust file type detection with extension fallback.
 * MIME is authoritative when available to avoid ambiguous extensions like .webm.
 * Explicitly check for application/octet-stream and treat as "MIME not available".
 */
const isAudioFile = (file: File | undefined): boolean =>
    file && file.type && file.type !== 'application/octet-stream'
        ? file.type.startsWith('audio/')
        : file
          ? /\.(mp3|m4a|aac|ogg|wav|flac|opus|weba|3gp|3gpp)$/i.test(file.name)
          : false;

const isVideoFile = (file: File | undefined): boolean =>
    file && file.type && file.type !== 'application/octet-stream'
        ? file.type.startsWith('video/')
        : file
          ? /\.(mp4|webm|mov|m4v)$/i.test(file.name)
          : false;

/**
 * MediaFile helpers that consider both kind (from existing attachments) and file type
 */
const isAudioMedia = (m: MediaFile): boolean =>
    m.kind === 'audio' || !!(m.file && isAudioFile(m.file));

const isVideoMedia = (m: MediaFile): boolean =>
    m.kind === 'video' || m.kind === 'gifv' || !!(m.file && isVideoFile(m.file));

/**
 * Hook for managing media uploads in compose modal
 * Handles file validation, upload progress, and cleanup
 */
export function useMediaUpload({
    accountSession,
    instanceConfig,
    isOpen,
    showPoll,
    isSubmitting,
    isLoadingEditSource,
    onError,
}: UseMediaUploadOptions): UseMediaUploadReturn {
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);

    // Track media IDs that are currently uploading to prevent duplicate uploads
    const uploadingMediaIdsRef = useRef<Set<string>>(new Set());

    const isUploading = mediaFiles.some((m) => m.uploading);
    const hasMedia = mediaFiles.length > 0;

    /**
     * Revoke object URLs for locally created previews
     */
    const revokePreviewUrls = useCallback((files: MediaFile[]) => {
        files.forEach((m) => {
            if (m.preview && !m.isExisting) {
                URL.revokeObjectURL(m.preview);
            }
        });
    }, []);

    /**
     * Process files for upload (shared between file picker and clipboard paste)
     * Validates and adds files to state; actual upload is handled by useEffect
     */
    const processFiles = useCallback(
        (rawFiles: File[], source: 'picker' | 'clipboard') => {
            if (!accountSession) return;

            // Poll and media are mutually exclusive
            if (showPoll) {
                onError('投票とメディアは同時に添付できません');
                return;
            }

            if (isUploading || isSubmitting || isLoadingEditSource) return;

            // Get supported MIME types
            const supported = new Set(
                (instanceConfig?.supportedMimeTypes ?? getDefaultConfig().supportedMimeTypes).map(
                    (t) => t.toLowerCase()
                )
            );

            // For clipboard, filter to images only
            const candidates =
                source === 'clipboard'
                    ? rawFiles.filter((f) => f.type.startsWith('image/'))
                    : rawFiles;

            // Atomically validate and add files using prev to avoid race conditions
            setMediaFiles((prev) => {
                // Calculate remaining slots based on current state
                const remainingSlots = (instanceConfig?.maxMediaAttachments ?? 4) - prev.length;
                const filesToAdd = candidates.slice(0, remainingSlots);
                if (filesToAdd.length === 0) {
                    // Set error outside of setState callback
                    if (candidates.length > 0) {
                        setTimeout(() => onError('これ以上添付できません'), 0);
                    }
                    return prev;
                }

                // Validate MIME types (important for clipboard which bypasses accept attribute)
                const unsupported = filesToAdd.find((f) => {
                    // Skip validation for files without proper MIME type detection
                    // (browser couldn't determine type, so allow it through)
                    if (!f.type || f.type === 'application/octet-stream') return false;
                    return !supported.has(f.type.toLowerCase());
                });
                if (unsupported) {
                    setTimeout(() => onError(`未対応のファイル形式です: ${unsupported.type}`), 0);
                    return prev;
                }

                // Check for video - video can only be alone
                const hasVideo = prev.some((m) => isVideoMedia(m));
                const newHasVideo = filesToAdd.some((f) => isVideoFile(f));

                // Check for audio - audio can only be alone (Mastodon specification)
                const hasAudio = prev.some((m) => isAudioMedia(m));
                const newHasAudio = filesToAdd.some((f) => isAudioFile(f));

                // Video cannot be mixed with other media
                if (hasVideo || (newHasVideo && prev.length > 0)) {
                    setTimeout(() => onError('動画は他のメディアと同時に添付できません'), 0);
                    return prev;
                }

                if (newHasVideo && filesToAdd.length > 1) {
                    setTimeout(() => onError('動画は1つのみ添付できます'), 0);
                    return prev;
                }

                // Audio cannot be mixed with other media (Mastodon spec)
                if (hasAudio || (newHasAudio && prev.length > 0)) {
                    setTimeout(() => onError('音声は他のメディアと同時に添付できません'), 0);
                    return prev;
                }

                if (newHasAudio && filesToAdd.length > 1) {
                    setTimeout(() => onError('音声は1つのみ添付できます'), 0);
                    return prev;
                }

                // Audio and video cannot be mixed even when both are new
                if (newHasAudio && newHasVideo) {
                    setTimeout(() => onError('音声と動画を同時に添付できません'), 0);
                    return prev;
                }

                // Create pending media files with stable localId
                const pending = filesToAdd.map((file) => ({
                    localId: crypto.randomUUID(),
                    file,
                    preview: URL.createObjectURL(file),
                    uploading: true,
                    altText: '',
                }));

                return [...prev, ...pending];
            });
        },
        [
            accountSession,
            showPoll,
            isUploading,
            isSubmitting,
            isLoadingEditSource,
            instanceConfig,
            onError,
        ]
    );

    // Upload media files that are pending (uploading: true)
    // This effect ensures uploads are triggered after React state updates are committed
    useEffect(() => {
        if (!accountSession) return;

        // Find items that need uploading
        const itemsToUpload = mediaFiles.filter(
            (m) => m.uploading && m.file && !uploadingMediaIdsRef.current.has(m.localId)
        );

        if (itemsToUpload.length === 0) return;

        const client = getClient(accountSession);

        // Mark items as being uploaded to prevent duplicate uploads
        itemsToUpload.forEach((item) => {
            uploadingMediaIdsRef.current.add(item.localId);
        });

        // Upload each file
        for (const item of itemsToUpload) {
            uploadMedia(client, item.file!)
                .then((media) => {
                    setMediaFiles((prev) =>
                        prev.map((m) =>
                            m.localId === item.localId
                                ? { ...m, uploading: false, uploadedId: media.id }
                                : m
                        )
                    );
                })
                .catch((err) => {
                    console.error('Failed to upload media:', err);
                    setMediaFiles((prev) =>
                        prev.map((m) =>
                            m.localId === item.localId
                                ? {
                                      ...m,
                                      uploading: false,
                                      error:
                                          err instanceof Error
                                              ? err.message
                                              : 'アップロードに失敗しました',
                                  }
                                : m
                        )
                    );
                })
                .finally(() => {
                    uploadingMediaIdsRef.current.delete(item.localId);
                });
        }
    }, [mediaFiles, accountSession]);

    const handleFileSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            void processFiles(files, 'picker');
            // Reset input value to allow re-selecting the same file
            if (e.target) e.target.value = '';
        },
        [processFiles]
    );

    /**
     * Handle clipboard paste for image uploads
     */
    const handlePaste = useCallback(
        (e: React.ClipboardEvent): boolean => {
            // Extract files from clipboardData.items (modern API)
            const fromItems = Array.from(e.clipboardData.items)
                .filter((i) => i.kind === 'file')
                .map((i) => i.getAsFile())
                .filter((f): f is File => f !== null);

            // Fallback to clipboardData.files (legacy)
            const files = fromItems.length > 0 ? fromItems : Array.from(e.clipboardData.files);

            // If no images, allow default text paste behavior
            const hasImages = files.some((f) => f.type.startsWith('image/'));
            if (!hasImages) return false;

            void processFiles(files, 'clipboard');
            return true;
        },
        [processFiles]
    );

    const removeMedia = useCallback((localId: string) => {
        setMediaFiles((prev) => {
            const media = prev.find((m) => m.localId === localId);
            // Only revoke URLs that were created locally (not existing media)
            if (media?.preview && !media.isExisting) {
                URL.revokeObjectURL(media.preview);
            }
            return prev.filter((m) => m.localId !== localId);
        });
    }, []);

    const updateAltText = useCallback((localId: string, altText: string) => {
        setMediaFiles((prev) => prev.map((m) => (m.localId === localId ? { ...m, altText } : m)));
    }, []);

    const clearMedia = useCallback(() => {
        setMediaFiles((prev) => {
            revokePreviewUrls(prev);
            return [];
        });
    }, [revokePreviewUrls]);

    // Cleanup on unmount or when modal closes
    useEffect(() => {
        if (!isOpen) {
            revokePreviewUrls(mediaFiles);
            setMediaFiles([]);
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    }, [isOpen]);

    return {
        mediaFiles,
        isUploading,
        hasMedia,
        handleFileSelect,
        handlePaste,
        removeMedia,
        updateAltText,
        clearMedia,
        setMediaFiles,
    };
}
