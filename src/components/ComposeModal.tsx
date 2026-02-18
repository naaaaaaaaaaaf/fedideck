import { useState, useRef, useEffect, useCallback } from 'react';
import type { mastodon } from 'masto';
import {
    LuX,
    LuTriangleAlert,
    LuLoader,
    LuImage,
    LuListOrdered,
    LuPlus,
    LuMinus,
    LuCornerUpLeft,
    LuChevronDown,
    LuSmile,
} from 'react-icons/lu';
import { useAccountsStore } from '../store/accounts';
import {
    getClient,
    createStatus,
    uploadMedia,
    updateMediaDescription,
    waitForMediaReady,
    getStatusSource,
    editStatus,
    type CreateStatusParams,
    type EditStatusParams,
} from '../api/mastoClient';
import { getInstanceConfig, getDefaultConfig, type InstanceConfig } from '../api/instanceConfig';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { type Visibility, getVisibilityOptions } from '../utils/statusVisibility';
import { useTextareaCursor } from '../hooks/useTextareaCursor';
import { DisplayName } from './DisplayName';
import { EmojiPalette } from './EmojiPalette';

/**
 * Reply target status information
 */
export interface ReplyToStatus {
    id: string;
    acct: string;
    displayName: string;
    content: string;
    avatar: string;
}

/**
 * Edit target status information
 * Contains the full Status object for prefilling media/visibility/sensitive
 */
export interface EditTarget {
    status: mastodon.v1.Status;
    accountSessionId: string;
}

interface ComposeModalProps {
    isOpen: boolean;
    onClose: () => void;
    replyToStatus?: ReplyToStatus;
    accountId?: string; // If provided (reply), lock to this account; otherwise allow switching
    editTarget?: EditTarget;
    onStatusEdited?: (status: mastodon.v1.Status) => void;
}

interface MediaFile {
    localId: string; // Unique identifier for stable updates
    file?: File; // Optional for existing media from edit
    preview: string;
    uploading: boolean;
    uploadedId?: string;
    error?: string;
    altText: string;
    isExisting?: boolean; // Flag for existing attachments from edit
    kind?: 'image' | 'video' | 'audio' | 'gifv' | 'unknown'; // Media type for existing attachments
}

const VISIBILITY_OPTIONS = getVisibilityOptions();

const MAX_POLL_OPTIONS = 4;
const MIN_POLL_OPTIONS = 2;

interface PollOptionDraft {
    id: string;
    text: string;
}

const createPollOption = (): PollOptionDraft => ({
    id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `poll-opt-${crypto.randomUUID()}`
            : `poll-opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text: '',
});

const createInitialPollOptions = (): PollOptionDraft[] => [createPollOption(), createPollOption()];

const POLL_DURATION_OPTIONS = [
    { value: 300, label: '5分' },
    { value: 1800, label: '30分' },
    { value: 3600, label: '1時間' },
    { value: 21600, label: '6時間' },
    { value: 86400, label: '1日' },
    { value: 259200, label: '3日' },
    { value: 604800, label: '7日' },
];

export function ComposeModal({
    isOpen,
    onClose,
    replyToStatus,
    accountId,
    editTarget,
    onStatusEdited,
}: ComposeModalProps) {
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState<Visibility>('public');
    const [showCW, setShowCW] = useState(false);
    const [cwText, setCwText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
    const [isSensitive, setIsSensitive] = useState(false);

    // Poll state
    const [showPoll, setShowPoll] = useState(false);
    const [pollOptions, setPollOptions] = useState<PollOptionDraft[]>(createInitialPollOptions);
    const [pollExpiresIn, setPollExpiresIn] = useState(86400); // 1 day default
    const [pollMultiple, setPollMultiple] = useState(false);

    // Edit mode state
    const isEditMode = Boolean(editTarget);
    const [isLoadingEditSource, setIsLoadingEditSource] = useState(false);
    const editSourceRequestRef = useRef<number>(0);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);
    // Track IME composition state for cross-browser compatibility (Safari fix)
    const isComposingRef = useRef(false);
    // Track media IDs that are currently uploading to prevent duplicate uploads
    const uploadingMediaIdsRef = useRef<Set<string>>(new Set());
    const accounts = useAccountsStore((state) => state.accounts);
    const activeAccountId = useAccountsStore((state) => state.activeAccountId);

    // Whether account switching is allowed (disabled for replies and edit mode)
    const isAccountLocked = !!accountId || isEditMode;

    // State for selected account (can be changed by user for new posts, but locked for replies)
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
        accountId ?? activeAccountId
    );
    const [showAccountSelector, setShowAccountSelector] = useState(false);
    const [focusedAccountIndex, setFocusedAccountIndex] = useState(0);

    // Emoji palette state
    const [showEmojiPalette, setShowEmojiPalette] = useState(false);

    // Instance configuration state
    const [instanceConfig, setInstanceConfig] = useState<InstanceConfig | null>(null);
    // Track the current request generation to ignore stale responses
    const configRequestRef = useRef<number>(0);

    // Textarea cursor hook - pass setContent to update React state
    const { insertAtCursor } = useTextareaCursor(textareaRef, setContent);

    // Get the account to compose from (for replies, use locked accountId; for edit mode, use editTarget's session; for new posts, use selected)
    const composingAccount = isAccountLocked
        ? (accounts.find((a) => a.id === accountId) ??
          (isEditMode && editTarget
              ? accounts.find((a) => a.id === editTarget.accountSessionId)
              : undefined))
        : (accounts.find((a) => a.id === selectedAccountId) ??
          accounts.find((a) => a.id === activeAccountId));

    const isUploading = mediaFiles.some((m) => m.uploading);
    const canCloseModal = !isSubmitting && !isUploading && !isLoadingEditSource;

    const { handleKeyDown: handleModalKeyDown } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
        canClose: canCloseModal,
    });

    // Focus management for account selector listbox
    useEffect(() => {
        if (showAccountSelector && listboxRef.current) {
            listboxRef.current.focus();
        }
    }, [showAccountSelector]);

    // Reset selected account when modal opens
    useEffect(() => {
        if (isOpen) {
            // For replies, use accountId; for edit mode, use editTarget's session; for new posts, use active account
            setSelectedAccountId(
                accountId ??
                    (isEditMode && editTarget ? editTarget.accountSessionId : activeAccountId)
            );
            setShowAccountSelector(false);
            setShowEmojiPalette(false);
        }
    }, [isOpen, activeAccountId, accountId, isEditMode, editTarget]);

    // Prefill content with mention when replying
    useEffect(() => {
        if (replyToStatus && isOpen) {
            const mention = `@${replyToStatus.acct} `;
            setContent(mention);
        }
    }, [replyToStatus, isOpen]);

    // Prefill content for edit mode
    useEffect(() => {
        if (!editTarget || !isOpen || !composingAccount) return;

        // Increment request generation for race condition prevention
        const requestGen = ++editSourceRequestRef.current;
        setIsLoadingEditSource(true);

        const prefillEdit = async () => {
            try {
                const client = getClient(composingAccount);
                const source = await getStatusSource(client, editTarget.status.id);

                // Ignore stale responses
                if (requestGen !== editSourceRequestRef.current) return;

                const status = editTarget.status;

                // Set text content from source
                setContent(source.text);

                // Set CW state explicitly (even if empty, to clear stale state)
                setCwText(source.spoilerText);
                setShowCW(!!source.spoilerText);

                // Set visibility (cannot be changed in edit mode, but prefill for display)
                setVisibility(status.visibility as Visibility);

                // Set sensitive flag
                setIsSensitive(status.sensitive ?? false);

                // Convert existing media attachments to MediaFile format
                // Always set mediaFiles to clear stale state from previous edits
                if (status.mediaAttachments && status.mediaAttachments.length > 0) {
                    const existingMedia: MediaFile[] = status.mediaAttachments.map((media) => ({
                        localId: `media-${media.id}`, // Use uploadedId for deterministic stable ID
                        preview: media.url ?? media.previewUrl ?? '',
                        uploading: false,
                        uploadedId: media.id,
                        altText: media.description ?? '',
                        isExisting: true,
                        kind: media.type,
                    }));
                    setMediaFiles(existingMedia);
                } else {
                    setMediaFiles([]);
                }

                // Poll editing is disabled for first version (product scope decision)
                // API supports it but resets votes
            } catch (err) {
                console.error('Failed to fetch status source for edit:', err);
                // On error, display error message to user
                setError('編集用データの取得に失敗しました');
            } finally {
                if (requestGen === editSourceRequestRef.current) {
                    setIsLoadingEditSource(false);
                }
            }
        };

        prefillEdit();

        // Cleanup: invalidate pending requests
        // Copy ref to local variable for use in cleanup function
        const ref = editSourceRequestRef;
        return () => {
            ref.current++;
        };
    }, [editTarget, isOpen, composingAccount]);

    // Fetch instance configuration when composing account changes
    useEffect(() => {
        // Don't fetch if modal is closed or no account selected
        if (!composingAccount || !isOpen) {
            return;
        }

        const instanceUrl = composingAccount.instanceUrl;
        // Reset config when account changes
        setInstanceConfig(null);

        // Increment request generation for this effect run
        const requestGen = ++configRequestRef.current;
        const ref = configRequestRef;

        const client = getClient(composingAccount);
        getInstanceConfig(client, instanceUrl)
            .then((config) => {
                // Only update if this is still the latest request
                if (requestGen === ref.current) {
                    setInstanceConfig(config);
                }
            })
            .catch((err) => {
                // Ignore errors from stale requests
                if (requestGen !== ref.current) return;
                console.error('Failed to fetch instance config:', err);
                // Use default config as fallback
                setInstanceConfig(getDefaultConfig());
            });

        // Cleanup: invalidate pending requests on unmount or dependency change
        return () => {
            ref.current++;
        };
    }, [composingAccount, isOpen]);

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
        composingAccount &&
        (!hasMedia || allMediaUploaded) &&
        isPollValid;

    // Poll helper functions
    const togglePoll = () => {
        if (!showPoll) {
            // Clear media when enabling poll (they're mutually exclusive)
            if (hasMedia) {
                mediaFiles.forEach((m) => {
                    if (m.preview) URL.revokeObjectURL(m.preview);
                });
                setMediaFiles([]);
            }
        }
        setShowPoll(!showPoll);
    };

    const addPollOption = () => {
        setPollOptions((prev) =>
            prev.length < MAX_POLL_OPTIONS ? [...prev, createPollOption()] : prev
        );
    };

    const removePollOption = (id: string) => {
        setPollOptions((prev) =>
            prev.length > MIN_POLL_OPTIONS ? prev.filter((opt) => opt.id !== id) : prev
        );
    };

    const updatePollOption = (id: string, value: string) => {
        setPollOptions((prev) =>
            prev.map((opt) => (opt.id === id ? { ...opt, text: value } : opt))
        );
    };

    // Robust file type detection with extension fallback.
    // MIME is authoritative when available to avoid ambiguous extensions like .webm.
    // Explicitly check for application/octet-stream and treat as "MIME not available".
    const isAudioFile = (file: File | undefined) =>
        file && file.type && file.type !== 'application/octet-stream'
            ? file.type.startsWith('audio/')
            : file
              ? /\.(mp3|m4a|aac|ogg|wav|flac|opus|weba|3gp|3gpp)$/i.test(file.name)
              : false;
    const isVideoFile = (file: File | undefined) =>
        file && file.type && file.type !== 'application/octet-stream'
            ? file.type.startsWith('video/')
            : file
              ? /\.(mp4|webm|mov|m4v)$/i.test(file.name)
              : false;

    // MediaFile helpers that consider both kind (from existing attachments) and file type
    const isAudioMedia = (m: MediaFile) => m.kind === 'audio' || (m.file && isAudioFile(m.file));
    const isVideoMedia = (m: MediaFile) =>
        m.kind === 'video' || m.kind === 'gifv' || (m.file && isVideoFile(m.file));

    /**
     * Process files for upload (shared between file picker and clipboard paste)
     * Validates and adds files to state; actual upload is handled by useEffect
     */
    const processFiles = (rawFiles: File[], source: 'picker' | 'clipboard') => {
        if (!composingAccount) return;

        // Poll and media are mutually exclusive
        if (showPoll) {
            setError('投票とメディアは同時に添付できません');
            return;
        }

        if (isUploading || isSubmitting || isLoadingEditSource) return;

        // Get supported MIME types
        const supported = new Set(
            (instanceConfig?.supportedMimeTypes ?? getDefaultConfig().supportedMimeTypes).map((t) =>
                t.toLowerCase()
            )
        );

        // For clipboard, filter to images only
        const candidates =
            source === 'clipboard' ? rawFiles.filter((f) => f.type.startsWith('image/')) : rawFiles;

        // Atomically validate and add files using prev to avoid race conditions
        setMediaFiles((prev) => {
            // Calculate remaining slots based on current state
            const remainingSlots = (instanceConfig?.maxMediaAttachments ?? 4) - prev.length;
            const filesToAdd = candidates.slice(0, remainingSlots);
            if (filesToAdd.length === 0) {
                // Set error outside of setState callback
                if (candidates.length > 0) {
                    setTimeout(() => setError('これ以上添付できません'), 0);
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
                setTimeout(() => setError(`未対応のファイル形式です: ${unsupported.type}`), 0);
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
                setTimeout(() => setError('動画は他のメディアと同時に添付できません'), 0);
                return prev;
            }

            if (newHasVideo && filesToAdd.length > 1) {
                setTimeout(() => setError('動画は1つのみ添付できます'), 0);
                return prev;
            }

            // Audio cannot be mixed with other media (Mastodon spec)
            if (hasAudio || (newHasAudio && prev.length > 0)) {
                setTimeout(() => setError('音声は他のメディアと同時に添付できません'), 0);
                return prev;
            }

            if (newHasAudio && filesToAdd.length > 1) {
                setTimeout(() => setError('音声は1つのみ添付できます'), 0);
                return prev;
            }

            // Audio and video cannot be mixed even when both are new
            if (newHasAudio && newHasVideo) {
                setTimeout(() => setError('音声と動画を同時に添付できません'), 0);
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

            // Clear error on successful add
            setTimeout(() => setError(null), 0);

            return [...prev, ...pending];
        });
    };

    // Upload media files that are pending (uploading: true)
    // This effect ensures uploads are triggered after React state updates are committed
    useEffect(() => {
        if (!composingAccount) return;

        // Find items that need uploading
        const itemsToUpload = mediaFiles.filter(
            (m) => m.uploading && m.file && !uploadingMediaIdsRef.current.has(m.localId)
        );

        if (itemsToUpload.length === 0) return;

        const client = getClient(composingAccount);

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
    }, [mediaFiles, composingAccount]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        void processFiles(files, 'picker');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    /**
     * Handle clipboard paste for image uploads
     */
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        // Only handle image paste when focus is on the main content textarea
        // This allows normal text paste in other input fields (CW, alt text, etc.)
        if (e.target !== textareaRef.current) return;

        // Extract files from clipboardData.items (modern API)
        const fromItems = Array.from(e.clipboardData.items)
            .filter((i) => i.kind === 'file')
            .map((i) => i.getAsFile())
            .filter((f): f is File => f !== null);

        // Fallback to clipboardData.files (legacy)
        const files = fromItems.length > 0 ? fromItems : Array.from(e.clipboardData.files);

        // If no images, allow default text paste behavior
        const hasImages = files.some((f) => f.type.startsWith('image/'));
        if (!hasImages) return;

        e.preventDefault();
        void processFiles(files, 'clipboard');
    };

    const removeMedia = (localId: string) => {
        setMediaFiles((prev) => {
            const media = prev.find((m) => m.localId === localId);
            // Only revoke URLs that were created locally (not existing media)
            if (media?.preview && !media.isExisting) {
                URL.revokeObjectURL(media.preview);
            }
            return prev.filter((m) => m.localId !== localId);
        });
    };

    const updateAltText = (localId: string, altText: string) => {
        setMediaFiles((prev) => prev.map((m) => (m.localId === localId ? { ...m, altText } : m)));
    };

    const resetFormAndClose = useCallback(() => {
        // Clean up previews
        mediaFiles.forEach((m) => {
            // Only revoke URLs that were created locally (not existing media)
            if (m.preview && !m.isExisting) {
                URL.revokeObjectURL(m.preview);
            }
        });

        // Reset all form state
        setContent('');
        setCwText('');
        setShowCW(false);
        setVisibility('public');
        setMediaFiles([]);
        setIsSensitive(false);
        setShowPoll(false);
        setPollOptions(createInitialPollOptions());
        setPollExpiresIn(86400);
        setPollMultiple(false);
        setShowEmojiPalette(false);
        setError(null);
        setIsLoadingEditSource(false);
        onClose();
    }, [mediaFiles, onClose]);

    const handleSubmit = useCallback(async () => {
        if (!canSubmit || !composingAccount) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const client = getClient(composingAccount);

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
                                    setError('メディアの処理が完了しませんでした');
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

                // Reset form and close modal
                resetFormAndClose();
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
                // Images are typically ready immediately after upload
                // Use isAudioFile/isVideoFile for robust detection with extension fallback
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
                            setError('メディアの処理が完了しませんでした');
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

            // Reset form and close modal on success
            resetFormAndClose();
        } catch (err) {
            console.error('Failed to post status:', err);
            setError(err instanceof Error ? err.message : '投稿に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    }, [
        canSubmit,
        composingAccount,
        isEditMode,
        editTarget,
        showCW,
        cwText,
        isSensitive,
        hasMedia,
        allMediaUploaded,
        mediaFiles,
        onStatusEdited,
        resetFormAndClose,
        content,
        visibility,
        replyToStatus,
        showPoll,
        validPollOptions,
        pollExpiresIn,
        pollMultiple,
    ]);

    const handleClose = () => {
        if (isSubmitting || isUploading || isLoadingEditSource) return;

        // Clean up previews (only locally created URLs)
        mediaFiles.forEach((m) => {
            if (m.preview && !m.isExisting) {
                URL.revokeObjectURL(m.preview);
            }
        });
        setMediaFiles([]);
        setShowEmojiPalette(false);
        setIsLoadingEditSource(false);
        setError(null);
        onClose();
    };

    // Keyboard shortcut handler for Ctrl+Enter / Cmd+Enter submission
    const handleSubmitShortcut = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            const isSubmitShortcut = e.key === 'Enter' && (e.ctrlKey || e.metaKey);
            if (!isSubmitShortcut) return;

            // Don't submit during IME composition or key repeat
            // Use both native isComposing and ref tracking for Safari compatibility
            if (e.nativeEvent.isComposing || isComposingRef.current || e.repeat) return;

            e.preventDefault();
            if (canSubmit) {
                void handleSubmit();
            }
        },
        [canSubmit, handleSubmit]
    );

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onKeyDown={handleModalKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="compose-modal-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                onPaste={handlePaste}
                className="relative w-full max-w-lg mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden max-h-[90vh] flex flex-col"
            >
                {/* Loading overlay for edit mode */}
                {isLoadingEditSource && (
                    <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
                        <div className="flex flex-col items-center gap-3">
                            <LuLoader
                                className="w-8 h-8 text-indigo-400 animate-spin"
                                aria-hidden="true"
                            />
                            <span className="text-slate-300">編集データを読み込み中...</span>
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
                    <h2 id="compose-modal-title" className="text-lg font-semibold text-slate-100">
                        {isEditMode ? '投稿を編集' : replyToStatus ? '返信' : '新しい投稿'}
                    </h2>
                    <button
                        ref={closeButtonRef}
                        onClick={handleClose}
                        disabled={isSubmitting || isUploading}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50"
                        aria-label="閉じる"
                    >
                        <LuX className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {/* Account selector */}
                    {composingAccount && (
                        <div className="relative mb-3">
                            <button
                                onClick={() => {
                                    if (isAccountLocked) return;
                                    const newState = !showAccountSelector;
                                    setShowAccountSelector(newState);
                                    if (newState) {
                                        // Reset focused index to current account when opening
                                        const currentIndex = accounts.findIndex(
                                            (a) => a.id === selectedAccountId
                                        );
                                        setFocusedAccountIndex(
                                            currentIndex >= 0 ? currentIndex : 0
                                        );
                                    }
                                }}
                                disabled={isAccountLocked}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                                    isAccountLocked ? 'cursor-default' : 'hover:bg-slate-700/50'
                                }`}
                                aria-expanded={showAccountSelector}
                                aria-haspopup="listbox"
                                aria-label={`投稿アカウント: ${composingAccount.account.displayName || composingAccount.account.username}`}
                            >
                                <img
                                    src={composingAccount.account.avatar}
                                    alt=""
                                    className="w-8 h-8 rounded-lg"
                                />
                                <div className="text-sm flex-1 min-w-0">
                                    <DisplayName
                                        account={composingAccount.account}
                                        className="text-slate-200 truncate block"
                                    />
                                    <div className="text-slate-400 truncate">
                                        @{composingAccount.account.acct}
                                    </div>
                                </div>
                                {!isAccountLocked && accounts.length > 1 && (
                                    <LuChevronDown
                                        className={`w-4 h-4 text-slate-400 transition-transform ${showAccountSelector ? 'rotate-180' : ''}`}
                                        aria-hidden="true"
                                    />
                                )}
                            </button>

                            {/* Account dropdown */}
                            {!isAccountLocked && showAccountSelector && accounts.length > 1 && (
                                <div
                                    ref={listboxRef}
                                    className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 overflow-hidden"
                                    role="listbox"
                                    aria-label="アカウント一覧"
                                    aria-activedescendant={
                                        focusedAccountIndex >= 0 &&
                                        focusedAccountIndex < accounts.length &&
                                        accounts[focusedAccountIndex]?.id
                                            ? `account-option-${accounts[focusedAccountIndex].id}`
                                            : undefined
                                    }
                                    tabIndex={-1}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setFocusedAccountIndex(
                                                (prev) => (prev + 1) % accounts.length
                                            );
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setFocusedAccountIndex(
                                                (prev) =>
                                                    (prev - 1 + accounts.length) % accounts.length
                                            );
                                        } else if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSelectedAccountId(accounts[focusedAccountIndex].id);
                                            setShowAccountSelector(false);
                                        } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowAccountSelector(false);
                                        } else if (e.key === 'Tab') {
                                            // Close listbox and allow Tab to move focus naturally
                                            setShowAccountSelector(false);
                                            // stopPropagation to prevent modal's focus trap from interfering
                                            e.stopPropagation();
                                        }
                                    }}
                                >
                                    {accounts.map((acc, index) => (
                                        <button
                                            key={acc.id}
                                            id={`account-option-${acc.id}`}
                                            onClick={() => {
                                                setSelectedAccountId(acc.id);
                                                setShowAccountSelector(false);
                                            }}
                                            className={`flex items-center gap-2 p-2 w-full text-left hover:bg-slate-700/50 transition-colors ${acc.id === selectedAccountId ? 'bg-slate-700/30' : ''} ${index === focusedAccountIndex ? 'bg-slate-700/40' : ''}
                                                }`}
                                            role="option"
                                            aria-selected={acc.id === selectedAccountId}
                                            tabIndex={-1}
                                        >
                                            <img
                                                src={acc.account.avatar}
                                                alt=""
                                                className="w-8 h-8 rounded-lg"
                                            />
                                            <div className="text-sm flex-1 min-w-0">
                                                <DisplayName
                                                    account={acc.account}
                                                    className="text-slate-200 truncate block"
                                                />
                                                <div className="text-slate-400 truncate">
                                                    @{acc.account.acct}
                                                </div>
                                            </div>
                                            {acc.id === selectedAccountId && (
                                                <div
                                                    className="w-2 h-2 rounded-full bg-indigo-400"
                                                    aria-hidden="true"
                                                ></div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reply indicator */}
                    {replyToStatus && (
                        <div className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
                                <LuCornerUpLeft className="w-4 h-4" aria-hidden="true" />
                                <span>返信先:</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <img
                                    src={replyToStatus.avatar}
                                    alt=""
                                    className="w-8 h-8 rounded-lg shrink-0"
                                />
                                <div className="min-w-0">
                                    <div className="text-sm text-slate-200 font-medium truncate">
                                        {replyToStatus.displayName}
                                    </div>
                                    <div className="text-xs text-slate-400 truncate">
                                        @{replyToStatus.acct}
                                    </div>
                                    <div
                                        className="text-sm text-slate-300 mt-1 line-clamp-2 status-content"
                                        dangerouslySetInnerHTML={{ __html: replyToStatus.content }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CW, Media, and Poll buttons */}
                    <div
                        className="mb-3 flex flex-wrap gap-2"
                        role="group"
                        aria-label="投稿オプション"
                    >
                        <button
                            onClick={() => setShowCW(!showCW)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                showCW
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                            }`}
                            aria-pressed={showCW}
                        >
                            <LuTriangleAlert className="w-4 h-4" aria-hidden="true" />
                            CW
                        </button>

                        <div className="relative">
                            <button
                                ref={emojiButtonRef}
                                onClick={() => setShowEmojiPalette(!showEmojiPalette)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                    showEmojiPalette
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                                }`}
                                aria-pressed={showEmojiPalette}
                                aria-label="絵文字を挿入"
                            >
                                <LuSmile className="w-4 h-4" aria-hidden="true" />
                                絵文字
                            </button>

                            {/* Emoji palette */}
                            <EmojiPalette
                                isOpen={showEmojiPalette}
                                onClose={() => setShowEmojiPalette(false)}
                                onSelect={insertAtCursor}
                                session={composingAccount ?? null}
                                triggerRef={emojiButtonRef}
                                textareaRef={textareaRef}
                            />
                        </div>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={
                                mediaFiles.length >= (instanceConfig?.maxMediaAttachments ?? 4) ||
                                isUploading ||
                                showPoll
                            }
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                hasMedia
                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            aria-label={`メディアを追加${
                                hasMedia
                                    ? ` (${mediaFiles.length}/${instanceConfig?.maxMediaAttachments ?? 4})`
                                    : ''
                            }`}
                        >
                            <LuImage className="w-4 h-4" aria-hidden="true" />
                            画像/動画/音声
                            {hasMedia && (
                                <span className="text-xs">
                                    ({mediaFiles.length}/{instanceConfig?.maxMediaAttachments ?? 4})
                                </span>
                            )}
                        </button>

                        <button
                            onClick={togglePoll}
                            disabled={hasMedia || isEditMode}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                showPoll
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            aria-pressed={showPoll}
                            title={isEditMode ? '編集中は投票を変更できません' : undefined}
                        >
                            <LuListOrdered className="w-4 h-4" aria-hidden="true" />
                            投票
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={
                                instanceConfig?.supportedMimeTypes?.join(',') ??
                                getDefaultConfig().supportedMimeTypes.join(',')
                            }
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                            aria-hidden="true"
                        />
                    </div>

                    {showCW && (
                        <div className="mb-3">
                            <label htmlFor="cw-text-input" className="sr-only">
                                警告文
                            </label>
                            <input
                                id="cw-text-input"
                                type="text"
                                value={cwText}
                                onChange={(e) => setCwText(e.target.value)}
                                placeholder="警告文を入力..."
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                    )}

                    {/* Poll UI */}
                    {showPoll && (
                        <fieldset className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <legend className="sr-only">投票設定</legend>
                            <div className="space-y-2 mb-3">
                                {pollOptions.map((option, index) => (
                                    <div key={option.id} className="flex gap-2">
                                        <label
                                            htmlFor={`poll-option-${option.id}`}
                                            className="sr-only"
                                        >
                                            選択肢 {index + 1}
                                        </label>
                                        <input
                                            id={`poll-option-${option.id}`}
                                            type="text"
                                            value={option.text}
                                            onChange={(e) =>
                                                updatePollOption(option.id, e.target.value)
                                            }
                                            placeholder={`選択肢 ${index + 1}`}
                                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                        />
                                        {pollOptions.length > MIN_POLL_OPTIONS && (
                                            <button
                                                onClick={() => removePollOption(option.id)}
                                                className="p-2 bg-slate-700 hover:bg-red-600/50 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                aria-label={`選択肢 ${index + 1} を削除`}
                                            >
                                                <LuMinus className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {pollOptions.length < MAX_POLL_OPTIONS && (
                                <button
                                    onClick={addPollOption}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                    <LuPlus className="w-4 h-4" aria-hidden="true" />
                                    選択肢を追加（最大{MAX_POLL_OPTIONS}）
                                </button>
                            )}

                            <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-700">
                                <div className="flex items-center gap-2">
                                    <label
                                        htmlFor="poll-duration-select"
                                        className="text-sm text-slate-400"
                                    >
                                        有効期限:
                                    </label>
                                    <select
                                        id="poll-duration-select"
                                        value={pollExpiresIn}
                                        onChange={(e) => setPollExpiresIn(Number(e.target.value))}
                                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                                    >
                                        {POLL_DURATION_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={pollMultiple}
                                        onChange={(e) => setPollMultiple(e.target.checked)}
                                        className="w-4 h-4 rounded bg-slate-900 border-slate-700"
                                    />
                                    複数選択可
                                </label>
                            </div>
                        </fieldset>
                    )}

                    {/* Media Preview */}
                    {hasMedia && (
                        <div className="mb-3 space-y-2">
                            {mediaFiles.map((media, index) => (
                                <div
                                    key={media.localId}
                                    className="bg-slate-800 rounded-lg overflow-hidden"
                                >
                                    <div
                                        className={`relative ${isAudioMedia(media) ? 'p-3' : 'aspect-video'}`}
                                    >
                                        {isAudioMedia(media) ? (
                                            <audio
                                                src={media.preview}
                                                controls
                                                preload="none"
                                                className="w-full"
                                            />
                                        ) : isVideoMedia(media) ? (
                                            <video
                                                src={media.preview}
                                                className="w-full h-full object-cover"
                                                muted
                                            />
                                        ) : (
                                            <img
                                                src={media.preview}
                                                alt={media.altText || `添付メディア ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        )}

                                        {/* Upload overlay */}
                                        {media.uploading && (
                                            <div
                                                className="absolute inset-0 bg-black/50 flex items-center justify-center"
                                                aria-busy="true"
                                                aria-label="アップロード中"
                                            >
                                                <LuLoader
                                                    className="w-6 h-6 text-white animate-spin"
                                                    aria-hidden="true"
                                                />
                                            </div>
                                        )}

                                        {/* Error overlay */}
                                        {media.error && (
                                            <div
                                                className="absolute inset-0 bg-red-900/50 flex items-center justify-center p-2"
                                                role="alert"
                                            >
                                                <span className="text-xs text-red-200 text-center">
                                                    {media.error}
                                                </span>
                                            </div>
                                        )}

                                        {/* Remove button */}
                                        <button
                                            onClick={() => removeMedia(media.localId)}
                                            disabled={media.uploading}
                                            className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50"
                                            aria-label={`メディア ${index + 1} を削除`}
                                        >
                                            <LuX className="w-4 h-4" aria-hidden="true" />
                                        </button>
                                    </div>

                                    {/* Alt text input */}
                                    <div className="p-2 border-t border-slate-700">
                                        <label
                                            htmlFor={`alt-text-${media.localId}`}
                                            className="sr-only"
                                        >
                                            メディア {index + 1} の代替テキスト
                                        </label>
                                        <input
                                            id={`alt-text-${media.localId}`}
                                            type="text"
                                            value={media.altText}
                                            onChange={(e) =>
                                                updateAltText(media.localId, e.target.value)
                                            }
                                            placeholder="代替テキストを追加..."
                                            disabled={media.uploading}
                                            className="w-full px-2 py-1 text-sm bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* NSFW toggle - only shown when media is attached */}
                    {hasMedia && (
                        <label className="flex items-center gap-2 mb-3 text-sm text-slate-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isSensitive}
                                onChange={(e) => setIsSensitive(e.target.checked)}
                                className="w-4 h-4 rounded bg-slate-900 border-slate-700"
                            />
                            閲覧注意 (NSFW)
                        </label>
                    )}

                    {/* Text area */}
                    <div>
                        <label htmlFor="compose-content" className="sr-only">
                            投稿内容
                        </label>
                        <textarea
                            ref={textareaRef}
                            id="compose-content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onKeyDown={handleSubmitShortcut}
                            onCompositionStart={() => {
                                isComposingRef.current = true;
                            }}
                            onCompositionEnd={() => {
                                isComposingRef.current = false;
                            }}
                            placeholder="今なにしてる？"
                            rows={6}
                            disabled={isSubmitting}
                            aria-keyshortcuts="Control+Enter Meta+Enter"
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                        />
                    </div>

                    {/* Character count */}
                    <div
                        className={`text-sm text-right mt-1 ${
                            isOverLimit
                                ? 'text-red-400'
                                : remainingChars <= 50
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                        }`}
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {remainingChars}
                    </div>

                    {/* Visibility selector */}
                    <fieldset className="mt-3">
                        <legend className="text-sm text-slate-400 mb-2">
                            公開範囲
                            {isEditMode && (
                                <span className="ml-2 text-xs text-amber-400">
                                    (編集中は変更できません)
                                </span>
                            )}
                        </legend>
                        <div className="grid grid-cols-2 gap-2">
                            {VISIBILITY_OPTIONS.map((option) => (
                                <label
                                    key={option.value}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                                        visibility === option.value
                                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                            : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                                    } ${isEditMode ? 'cursor-default' : 'cursor-pointer'}`}
                                >
                                    <input
                                        type="radio"
                                        name="visibility"
                                        value={option.value}
                                        checked={visibility === option.value}
                                        onChange={() => !isEditMode && setVisibility(option.value)}
                                        disabled={isEditMode}
                                        className="sr-only"
                                    />
                                    <span className="text-lg">{option.icon}</span>
                                    <div>
                                        <div className="text-sm font-medium">{option.label}</div>
                                        <div className="text-xs text-slate-400">
                                            {option.description}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {/* Error message */}
                    {error && (
                        <div
                            className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-700/50 bg-slate-800/50 shrink-0">
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting || isUploading}
                        className="px-4 py-2 text-slate-300 hover:text-slate-100 transition-colors disabled:opacity-50"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
                        aria-label={
                            isSubmitting
                                ? isEditMode
                                    ? '投稿を更新中'
                                    : '投稿を送信中'
                                : isUploading
                                  ? 'メディアをアップロード中'
                                  : isEditMode
                                    ? '投稿を更新'
                                    : '投稿を送信'
                        }
                    >
                        {(isSubmitting || isUploading || isLoadingEditSource) && (
                            <LuLoader className="w-4 h-4 animate-spin" aria-hidden="true" />
                        )}
                        {isSubmitting
                            ? isEditMode
                                ? '更新中...'
                                : '投稿中...'
                            : isUploading
                              ? 'アップロード中...'
                              : isEditMode
                                ? '更新'
                                : '投稿'}
                    </button>
                </div>
            </div>
        </div>
    );
}
