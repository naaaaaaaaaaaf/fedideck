import { useState, useCallback } from 'react';
import type { mastodon } from 'masto';
import {
    getClient,
    createStatus,
    editStatus,
    waitForMediaReady,
    updateMediaDescription,
    type AccountSession,
    type CreateStatusParams,
    type EditStatusParams,
} from '../api/mastoClient';
import type { MediaFile } from './useMediaUpload';
import type { EditTarget, ReplyToStatus } from '../components/ComposeModal';

/**
 * Visibility type for posts
 */
export type Visibility = 'public' | 'unlisted' | 'private' | 'direct';

/**
 * Poll option draft
 */
export interface PollOptionDraft {
    id: string;
    text: string;
}

/**
 * State required for post submission
 */
export interface PostSubmitState {
    content: string;
    visibility: Visibility;
    showCW: boolean;
    cwText: string;
    isSensitive: boolean;
    showPoll: boolean;
    pollOptions: PollOptionDraft[];
    pollExpiresIn: number;
    pollMultiple: boolean;
    mediaFiles: MediaFile[];
}

interface UsePostSubmitOptions {
    accountSession: AccountSession | null | undefined;
    isOpen: boolean;
    isEditMode: boolean;
    editTarget: EditTarget | undefined;
    replyToStatus: ReplyToStatus | undefined;
    state: PostSubmitState;
    instanceConfig: { maxCharacters: number } | null;
    isUploading: boolean;
    isLoadingEditSource: boolean;
    onSuccess: () => void;
    onStatusEdited?: (status: mastodon.v1.Status) => void;
    onError: (error: string) => void;
}

interface UsePostSubmitReturn {
    isSubmitting: boolean;
    canSubmit: boolean;
    remainingChars: number;
    handleSubmit: () => Promise<void>;
}

const MIN_POLL_OPTIONS = 2;

/**
 * Robust file type detection with extension fallback.
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
 * Hook for handling post submission in compose modal
 * Supports both new posts and edit mode
 */
export function usePostSubmit({
    accountSession,
    isOpen,
    isEditMode,
    editTarget,
    replyToStatus,
    state,
    instanceConfig,
    isUploading,
    isLoadingEditSource,
    onSuccess,
    onStatusEdited,
    onError,
}: UsePostSubmitOptions): UsePostSubmitReturn {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        content,
        visibility,
        showCW,
        cwText,
        isSensitive,
        showPoll,
        pollOptions,
        pollExpiresIn,
        pollMultiple,
        mediaFiles,
    } = state;

    const remainingChars = (instanceConfig?.maxCharacters ?? 500) - content.length;
    const isOverLimit = remainingChars < 0;
    const hasMedia = mediaFiles.length > 0;
    const allMediaUploaded = mediaFiles.every((m) => m.uploadedId && !m.uploading);

    // Poll validation
    const validPollOptions = pollOptions
        .filter((opt) => opt.text.trim().length > 0)
        .map((opt) => opt.text);
    const isPollValid = !showPoll || validPollOptions.length >= MIN_POLL_OPTIONS;

    const canSubmit =
        (content.trim().length > 0 || hasMedia || showPoll) &&
        !isOverLimit &&
        !isSubmitting &&
        !isUploading &&
        !isLoadingEditSource &&
        !!accountSession &&
        (!hasMedia || allMediaUploaded) &&
        isPollValid;

    const handleSubmit = useCallback(async () => {
        if (!canSubmit || !accountSession) return;

        setIsSubmitting(true);

        try {
            const client = getClient(accountSession);

            // Edit mode: update existing status
            if (isEditMode && editTarget) {
                const editParams: EditStatusParams = {
                    status: content,
                };

                // In edit mode, always send spoilerText and sensitive to allow removal
                editParams.spoilerText = showCW ? cwText.trim() : '';
                editParams.sensitive = isSensitive;

                // Handle media
                if (hasMedia && allMediaUploaded) {
                    // Wait for media processing (new uploads only)
                    for (const media of mediaFiles) {
                        if (media.uploadedId && !media.isExisting) {
                            const needsProcessing =
                                isAudioFile(media.file) || isVideoFile(media.file);
                            if (needsProcessing) {
                                try {
                                    await waitForMediaReady(client, media.uploadedId);
                                } catch (err) {
                                    console.error('Media processing timeout:', err);
                                    onError('メディアの処理が完了しませんでした');
                                    return;
                                }
                            }
                        }
                    }

                    // Update alt text for media that has it
                    const mediaAttributes: Array<{ id: string; description?: string }> = [];
                    for (const media of mediaFiles) {
                        const trimmedAlt = media.altText?.trim() ?? '';
                        if (media.uploadedId) {
                            // For existing media, always include in mediaAttributes
                            if (media.isExisting || trimmedAlt.length > 0) {
                                mediaAttributes.push({
                                    id: media.uploadedId,
                                    description: trimmedAlt.length > 0 ? trimmedAlt : '',
                                });
                            }
                        }
                    }

                    editParams.mediaIds = mediaFiles.map((m) => m.uploadedId!);
                    if (mediaAttributes.length > 0) {
                        editParams.mediaAttributes = mediaAttributes;
                    }
                } else if (!hasMedia) {
                    // Clear all media if none attached
                    editParams.mediaIds = [];
                }

                const updatedStatus = await editStatus(client, editTarget.status.id, editParams);
                onStatusEdited?.(updatedStatus);

                onSuccess();
                return;
            }

            // Create mode: create new status
            const params: CreateStatusParams = {
                status: content,
                visibility,
            };

            if (showCW && cwText.trim()) {
                params.spoilerText = cwText.trim();
            }

            if (replyToStatus) {
                params.inReplyToId = replyToStatus.id;
            }

            if (hasMedia && allMediaUploaded) {
                // Wait for media processing to complete (only needed for audio/video)
                for (const media of mediaFiles) {
                    if (media.uploadedId) {
                        const needsProcessing = isAudioFile(media.file) || isVideoFile(media.file);
                        if (!needsProcessing) {
                            continue;
                        }
                        try {
                            await waitForMediaReady(client, media.uploadedId);
                        } catch (err) {
                            console.error('Media processing timeout:', err);
                            onError('メディアの処理が完了しませんでした');
                            return;
                        }
                    }
                }

                // Update alt text for media that has it
                for (const media of mediaFiles) {
                    const trimmedAlt = media.altText?.trim() ?? '';
                    if (media.uploadedId && trimmedAlt.length > 0) {
                        try {
                            await updateMediaDescription(client, media.uploadedId, trimmedAlt);
                        } catch (err) {
                            console.warn('Failed to update media description:', err);
                            // Continue even if alt text update fails
                        }
                    }
                }
                params.mediaIds = mediaFiles.map((m) => m.uploadedId!);
                if (isSensitive) {
                    params.sensitive = true;
                }
            }

            // Add poll params if poll is enabled
            if (showPoll && validPollOptions.length >= MIN_POLL_OPTIONS) {
                params.poll = {
                    options: validPollOptions,
                    expiresIn: pollExpiresIn,
                    multiple: pollMultiple,
                };
            }

            await createStatus(client, params);

            onSuccess();
        } catch (err) {
            console.error('Failed to post status:', err);
            onError(err instanceof Error ? err.message : '投稿に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    }, [
        canSubmit,
        accountSession,
        isEditMode,
        editTarget,
        content,
        showCW,
        cwText,
        isSensitive,
        hasMedia,
        allMediaUploaded,
        mediaFiles,
        visibility,
        replyToStatus,
        showPoll,
        validPollOptions,
        pollExpiresIn,
        pollMultiple,
        onSuccess,
        onStatusEdited,
        onError,
    ]);

    return {
        isSubmitting,
        canSubmit,
        remainingChars,
        handleSubmit,
    };
}
