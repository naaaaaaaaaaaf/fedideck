import { useState, useRef, useEffect } from 'react';
import {
    LuX,
    LuTriangleAlert,
    LuGlobe,
    LuLockOpen,
    LuLock,
    LuMail,
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
    type CreateStatusParams,
} from '../api/mastoClient';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
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

interface ComposeModalProps {
    isOpen: boolean;
    onClose: () => void;
    replyToStatus?: ReplyToStatus;
    accountId?: string; // If provided (reply), lock to this account; otherwise allow switching
}

type Visibility = 'public' | 'unlisted' | 'private' | 'direct';

interface VisibilityOption {
    value: Visibility;
    label: string;
    description: string;
    icon: React.ReactNode;
}

interface MediaFile {
    file: File;
    preview: string;
    uploading: boolean;
    uploadedId?: string;
    error?: string;
    altText: string;
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
    {
        value: 'public',
        label: '公開',
        description: '全員に表示',
        icon: <LuGlobe aria-hidden="true" />,
    },
    {
        value: 'unlisted',
        label: '未収載',
        description: '公開タイムラインに表示しない',
        icon: <LuLockOpen aria-hidden="true" />,
    },
    {
        value: 'private',
        label: 'フォロワーのみ',
        description: 'フォロワーにのみ表示',
        icon: <LuLock aria-hidden="true" />,
    },
    {
        value: 'direct',
        label: 'ダイレクト',
        description: 'メンションしたユーザーにのみ表示',
        icon: <LuMail aria-hidden="true" />,
    },
];

const MAX_CHARS = 500;
const MAX_MEDIA = 4;
const MAX_POLL_OPTIONS = 4;
const MIN_POLL_OPTIONS = 2;
const ACCEPTED_MEDIA_TYPES = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm';

const POLL_DURATION_OPTIONS = [
    { value: 300, label: '5分' },
    { value: 1800, label: '30分' },
    { value: 3600, label: '1時間' },
    { value: 21600, label: '6時間' },
    { value: 86400, label: '1日' },
    { value: 259200, label: '3日' },
    { value: 604800, label: '7日' },
];

export function ComposeModal({ isOpen, onClose, replyToStatus, accountId }: ComposeModalProps) {
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
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [pollExpiresIn, setPollExpiresIn] = useState(86400); // 1 day default
    const [pollMultiple, setPollMultiple] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);
    const accounts = useAccountsStore((state) => state.accounts);
    const activeAccountId = useAccountsStore((state) => state.activeAccountId);

    // Whether account switching is allowed (disabled for replies)
    const isAccountLocked = !!accountId;

    // State for selected account (can be changed by user for new posts, but locked for replies)
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
        accountId ?? activeAccountId
    );
    const [showAccountSelector, setShowAccountSelector] = useState(false);
    const [focusedAccountIndex, setFocusedAccountIndex] = useState(0);

    // Emoji palette state
    const [showEmojiPalette, setShowEmojiPalette] = useState(false);

    // Textarea cursor hook - pass setContent to update React state
    const { insertAtCursor } = useTextareaCursor(textareaRef, setContent);

    // Get the account to compose from (for replies, use locked accountId; for new posts, use selected)
    const composingAccount = isAccountLocked
        ? accounts.find((a) => a.id === accountId)
        : (accounts.find((a) => a.id === selectedAccountId) ??
          accounts.find((a) => a.id === activeAccountId));

    const isUploading = mediaFiles.some((m) => m.uploading);
    const canCloseModal = !isSubmitting && !isUploading;

    const { handleKeyDown } = useModalAccessibility({
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
            // For replies, always use the provided accountId; for new posts, use active account
            setSelectedAccountId(accountId ?? activeAccountId);
            setShowAccountSelector(false);
        }
    }, [isOpen, activeAccountId, accountId]);

    // Prefill content with mention when replying
    useEffect(() => {
        if (replyToStatus && isOpen) {
            const mention = `@${replyToStatus.acct} `;
            setContent(mention);
        }
    }, [replyToStatus, isOpen]);

    const remainingChars = MAX_CHARS - content.length;
    const isOverLimit = remainingChars < 0;
    const hasMedia = mediaFiles.length > 0;
    const allMediaUploaded = mediaFiles.every((m) => m.uploadedId && !m.uploading);

    // Poll validation
    const validPollOptions = pollOptions.filter((opt) => opt.trim().length > 0);
    const isPollValid = !showPoll || validPollOptions.length >= MIN_POLL_OPTIONS;

    const canSubmit =
        (content.trim().length > 0 || hasMedia || showPoll) &&
        !isOverLimit &&
        !isSubmitting &&
        !isUploading &&
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
        if (pollOptions.length < MAX_POLL_OPTIONS) {
            setPollOptions([...pollOptions, '']);
        }
    };

    const removePollOption = (index: number) => {
        if (pollOptions.length > MIN_POLL_OPTIONS) {
            setPollOptions(pollOptions.filter((_, i) => i !== index));
        }
    };

    const updatePollOption = (index: number, value: string) => {
        const newOptions = [...pollOptions];
        newOptions[index] = value;
        setPollOptions(newOptions);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || !composingAccount) return;

        const remainingSlots = MAX_MEDIA - mediaFiles.length;
        const filesToAdd = Array.from(files).slice(0, remainingSlots);

        if (filesToAdd.length === 0) return;

        // Check for video - video can only be alone
        const hasVideo = mediaFiles.some((m) => m.file.type.startsWith('video/'));
        const newHasVideo = filesToAdd.some((f) => f.type.startsWith('video/'));

        if (hasVideo || (newHasVideo && mediaFiles.length > 0)) {
            setError('動画は他のメディアと同時に添付できません');
            return;
        }

        if (newHasVideo && filesToAdd.length > 1) {
            setError('動画は1つのみ添付できます');
            return;
        }

        const client = getClient(composingAccount);

        // Create preview and add to state
        const newMediaFiles: MediaFile[] = filesToAdd.map((file) => ({
            file,
            preview: URL.createObjectURL(file),
            uploading: true,
            altText: '',
        }));

        setMediaFiles((prev) => [...prev, ...newMediaFiles]);
        setError(null);

        // Upload each file
        for (let i = 0; i < filesToAdd.length; i++) {
            const file = filesToAdd[i];
            const mediaIndex = mediaFiles.length + i;

            try {
                const media = await uploadMedia(client, file);
                setMediaFiles((prev) =>
                    prev.map((m, idx) =>
                        idx === mediaIndex ? { ...m, uploading: false, uploadedId: media.id } : m
                    )
                );
            } catch (err) {
                console.error('Failed to upload media:', err);
                setMediaFiles((prev) =>
                    prev.map((m, idx) =>
                        idx === mediaIndex
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
            }
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeMedia = (index: number) => {
        setMediaFiles((prev) => {
            const media = prev[index];
            if (media.preview) {
                URL.revokeObjectURL(media.preview);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const updateAltText = (index: number, altText: string) => {
        setMediaFiles((prev) => prev.map((m, i) => (i === index ? { ...m, altText } : m)));
    };

    const handleSubmit = async () => {
        if (!canSubmit || !composingAccount) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const client = getClient(composingAccount);
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

            // Clean up previews
            mediaFiles.forEach((m) => {
                if (m.preview) URL.revokeObjectURL(m.preview);
            });

            // Reset form and close modal on success
            setContent('');
            setCwText('');
            setShowCW(false);
            setVisibility('public');
            setMediaFiles([]);
            setIsSensitive(false);
            setShowPoll(false);
            setPollOptions(['', '']);
            setPollExpiresIn(86400);
            setPollMultiple(false);
            onClose();
        } catch (err) {
            console.error('Failed to post status:', err);
            setError(err instanceof Error ? err.message : '投稿に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (isSubmitting || isUploading) return;

        // Clean up previews
        mediaFiles.forEach((m) => {
            if (m.preview) URL.revokeObjectURL(m.preview);
        });
        setMediaFiles([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onKeyDown={handleKeyDown}
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
                className="relative w-full max-w-lg mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden max-h-[90vh] flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
                    <h2 id="compose-modal-title" className="text-lg font-semibold text-slate-100">
                        {replyToStatus ? '返信' : '新しい投稿'}
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
                                className={`flex items-center gap-2 p-2 -m-2 rounded-lg transition-colors w-full text-left ${
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
                            {composingAccount && (
                                <EmojiPalette
                                    isOpen={showEmojiPalette}
                                    onClose={() => setShowEmojiPalette(false)}
                                    onSelect={insertAtCursor}
                                    customEmojis={composingAccount.emojis ?? []}
                                    triggerRef={emojiButtonRef}
                                    textareaRef={textareaRef}
                                />
                            )}
                        </div>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={mediaFiles.length >= MAX_MEDIA || isUploading || showPoll}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                hasMedia
                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            aria-label={`画像/動画を追加${hasMedia ? ` (${mediaFiles.length}/${MAX_MEDIA})` : ''}`}
                        >
                            <LuImage className="w-4 h-4" aria-hidden="true" />
                            画像/動画
                            {hasMedia && (
                                <span className="text-xs">
                                    ({mediaFiles.length}/{MAX_MEDIA})
                                </span>
                            )}
                        </button>

                        <button
                            onClick={togglePoll}
                            disabled={hasMedia}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                showPoll
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            aria-pressed={showPoll}
                        >
                            <LuListOrdered className="w-4 h-4" aria-hidden="true" />
                            投票
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={ACCEPTED_MEDIA_TYPES}
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
                                    <div key={index} className="flex gap-2">
                                        <label htmlFor={`poll-option-${index}`} className="sr-only">
                                            選択肢 {index + 1}
                                        </label>
                                        <input
                                            id={`poll-option-${index}`}
                                            type="text"
                                            value={option}
                                            onChange={(e) =>
                                                updatePollOption(index, e.target.value)
                                            }
                                            placeholder={`選択肢 ${index + 1}`}
                                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                        />
                                        {pollOptions.length > MIN_POLL_OPTIONS && (
                                            <button
                                                onClick={() => removePollOption(index)}
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
                                    key={index}
                                    className="bg-slate-800 rounded-lg overflow-hidden"
                                >
                                    <div className="relative aspect-video">
                                        {media.file.type.startsWith('video/') ? (
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
                                            onClick={() => removeMedia(index)}
                                            disabled={media.uploading}
                                            className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-50"
                                            aria-label={`メディア ${index + 1} を削除`}
                                        >
                                            <LuX className="w-4 h-4" aria-hidden="true" />
                                        </button>
                                    </div>

                                    {/* Alt text input */}
                                    <div className="p-2 border-t border-slate-700">
                                        <label htmlFor={`alt-text-${index}`} className="sr-only">
                                            メディア {index + 1} の代替テキスト
                                        </label>
                                        <input
                                            id={`alt-text-${index}`}
                                            type="text"
                                            value={media.altText}
                                            onChange={(e) => updateAltText(index, e.target.value)}
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
                            placeholder="今なにしてる？"
                            rows={6}
                            disabled={isSubmitting}
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
                        <legend className="text-sm text-slate-400 mb-2">公開範囲</legend>
                        <div className="grid grid-cols-2 gap-2">
                            {VISIBILITY_OPTIONS.map((option) => (
                                <label
                                    key={option.value}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                                        visibility === option.value
                                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                            : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="visibility"
                                        value={option.value}
                                        checked={visibility === option.value}
                                        onChange={() => setVisibility(option.value)}
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
                                ? '投稿を送信中'
                                : isUploading
                                  ? 'メディアをアップロード中'
                                  : '投稿を送信'
                        }
                    >
                        {(isSubmitting || isUploading) && (
                            <LuLoader className="w-4 h-4 animate-spin" aria-hidden="true" />
                        )}
                        {isSubmitting ? '投稿中...' : isUploading ? 'アップロード中...' : '投稿'}
                    </button>
                </div>
            </div>
        </div>
    );
}
