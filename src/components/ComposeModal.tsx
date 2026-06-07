import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { mastodon } from 'masto';
import { LuX, LuLoader } from 'react-icons/lu';
import { useAccountsStore } from '../store/accounts';
import { getDefaultConfig } from '../api/instanceConfig';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import type { Visibility } from '../utils/statusVisibility';
import { toVisibility } from '../utils/statusVisibility';
import { useTextareaCursor } from '../hooks/useTextareaCursor';
import { useInstanceConfig } from '../hooks/useInstanceConfig';
import { useEditPrefill, type EditPrefillData } from '../hooks/useEditPrefill';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { usePostSubmit } from '../hooks/usePostSubmit';
import { ComposeTextarea } from './compose/ComposeTextarea';
import { ComposeMediaPreview } from './compose/ComposeMediaPreview';
import { ComposePollForm, type PollOptionDraft } from './compose/ComposePollForm';
import { ComposeAccountSelector } from './compose/ComposeAccountSelector';
import { ComposeVisibilitySelector } from './compose/ComposeVisibilitySelector';
import { ComposeReplyIndicator } from './compose/ComposeReplyIndicator';
import { ComposeQuoteIndicator, type QuoteToStatus } from './compose/ComposeQuoteIndicator';
import { ComposeOptionButtons } from './compose/ComposeOptionButtons';
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

export type { QuoteToStatus };

interface ComposeModalProps {
    isOpen: boolean;
    onClose: () => void;
    replyToStatus?: ReplyToStatus;
    quoteToStatus?: QuoteToStatus;
    accountId?: string; // If provided (reply/quote), lock to this account; otherwise allow switching
    editTarget?: EditTarget;
    onStatusEdited?: (status: mastodon.v1.Status) => void;
    /** Whether this modal is the active (top-most) overlay */
    isActive?: boolean;
    zIndex?: number;
}

const MAX_POLL_OPTIONS = 4;
const MIN_POLL_OPTIONS = 2;

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
    quoteToStatus,
    accountId,
    editTarget,
    onStatusEdited,
    isActive = true,
    zIndex,
}: ComposeModalProps) {
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState<Visibility>('public');
    const [showCW, setShowCW] = useState(false);
    const [cwText, setCwText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSensitive, setIsSensitive] = useState(false);

    // Poll state
    const [showPoll, setShowPoll] = useState(false);
    const [pollOptions, setPollOptions] = useState<PollOptionDraft[]>(createInitialPollOptions);
    const [pollExpiresIn, setPollExpiresIn] = useState(86400); // 1 day default
    const [pollMultiple, setPollMultiple] = useState(false);

    // Edit mode state
    const isEditMode = Boolean(editTarget);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);
    // Track IME composition state for cross-browser compatibility (Safari fix)
    const isComposingRef = useRef(false);

    const accounts = useAccountsStore((state) => state.accounts);
    const activeAccountId = useAccountsStore((state) => state.activeAccountId);

    // Whether account switching is allowed (disabled for replies, quotes, and edit mode)
    const isAccountLocked = !!replyToStatus || !!quoteToStatus || isEditMode;

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

    // Get the account to compose from (for replies, use locked accountId; for edit mode, use editTarget's session; for new posts, use selected)
    const composingAccount = isAccountLocked
        ? (accounts.find((a) => a.id === accountId) ??
          (isEditMode && editTarget
              ? accounts.find((a) => a.id === editTarget.accountSessionId)
              : accounts.find((a) => a.id === activeAccountId)))
        : (accounts.find((a) => a.id === selectedAccountId) ??
          accounts.find((a) => a.id === activeAccountId));

    // Use extracted hooks
    // 1. Instance config hook
    const { instanceConfig } = useInstanceConfig({
        accountSession: composingAccount,
        isOpen,
    });

    // Refs for blocking media upload during submit or edit source loading
    // Updated synchronously during render to avoid race conditions
    const isSubmittingRef = useRef(false);
    const isLoadingEditSourceRef = useRef(false);

    // Ref to defer setMediaFiles call until after useMediaUpload is called
    const pendingMediaFilesRef = useRef<EditPrefillData['mediaFiles'] | null>(null);

    // 2. Edit prefill hook - callback defers setMediaFiles until after hook initialization
    const handleEditPrefill = useCallback((data: EditPrefillData) => {
        setContent(data.text);
        setCwText(data.spoilerText);
        setShowCW(!!data.spoilerText);
        setVisibility(toVisibility(data.visibility));
        setIsSensitive(data.sensitive);
        // Defer setMediaFiles until after useMediaUpload initializes
        pendingMediaFilesRef.current = data.mediaFiles;
    }, []);

    const { isLoading: isLoadingEditSource } = useEditPrefill({
        editTarget,
        accountSession: composingAccount,
        isOpen,
        onPrefill: handleEditPrefill,
        onError: setError,
    });

    // 3. Media upload hook
    const {
        mediaFiles,
        isUploading,
        hasMedia,
        handleFileSelect,
        handlePaste: handleMediaPaste,
        removeMedia,
        updateAltText,
        clearMedia,
        setMediaFiles,
    } = useMediaUpload({
        accountSession: composingAccount,
        instanceConfig,
        isOpen,
        showPoll,
        isSubmittingRef,
        isLoadingEditSourceRef,
        onError: setError,
    });

    // Process pending media files from edit prefill
    // Using useLayoutEffect to ensure media is set synchronously before paint
    // Note: We intentionally check the ref on every render, so empty deps is correct
    useLayoutEffect(() => {
        if (pendingMediaFilesRef.current !== null) {
            setMediaFiles(pendingMediaFilesRef.current);
            pendingMediaFilesRef.current = null;
        }
    });

    // 4. Post submit hook
    const {
        isSubmitting,
        canSubmit,
        remainingChars,
        handleSubmit: submitPost,
    } = usePostSubmit({
        accountSession: composingAccount,
        isOpen,
        isEditMode,
        editTarget,
        replyToStatus,
        quoteToStatus,
        state: {
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
        },
        instanceConfig,
        isUploading,
        isLoadingEditSource,
        onSuccess: resetFormAndClose,
        onStatusEdited,
        onError: setError,
    });

    // Keep refs in sync for useMediaUpload to check during processFiles
    // Using useLayoutEffect to update synchronously before paint, avoiding race conditions
    useLayoutEffect(() => {
        isSubmittingRef.current = isSubmitting;
    }, [isSubmitting]);

    useLayoutEffect(() => {
        isLoadingEditSourceRef.current = isLoadingEditSource;
    }, [isLoadingEditSource]);

    const canCloseModal = !isSubmitting && !isUploading && !isLoadingEditSource;

    const { handleKeyDown: handleModalKeyDown } = useModalAccessibility({
        isOpen: isOpen && isActive,
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
    /* eslint-disable react-hooks/set-state-in-effect */
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
    /* eslint-enable react-hooks/set-state-in-effect */

    // Prefill content with mention when replying
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (replyToStatus && isOpen) {
            const mention = `@${replyToStatus.acct} `;
            setContent(mention);
        }
    }, [replyToStatus, isOpen]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const isOverLimit = remainingChars < 0;

    // Poll helper functions
    const togglePoll = () => {
        if (!showPoll) {
            // Clear media when enabling poll (they're mutually exclusive)
            clearMedia();
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

    function resetFormAndClose() {
        // Clean up previews
        clearMedia();

        // Reset all form state
        setContent('');
        setCwText('');
        setShowCW(false);
        setVisibility('public');
        setIsSensitive(false);
        setShowPoll(false);
        setPollOptions(createInitialPollOptions());
        setPollExpiresIn(86400);
        setPollMultiple(false);
        setShowEmojiPalette(false);
        setError(null);
        onClose();
    }

    const handleClose = () => {
        if (isSubmitting || isUploading || isLoadingEditSource) return;

        // Clean up previews
        clearMedia();
        setShowEmojiPalette(false);
        setError(null);
        onClose();
    };

    // Handle paste for the modal
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        // Only handle image paste when focus is on the main content textarea
        if (e.target !== textareaRef.current) return;

        const handled = handleMediaPaste(e);
        if (handled) {
            e.preventDefault();
        }
    };

    // Handle submit button click
    const handleSubmitClick = () => {
        void submitPost();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center"
            style={zIndex != null ? { zIndex } : undefined}
            onKeyDown={isActive ? handleModalKeyDown : undefined}
            role="dialog"
            aria-modal={isActive ? 'true' : undefined}
            aria-hidden={!isActive ? true : undefined}
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
                        {isEditMode
                            ? '投稿を編集'
                            : replyToStatus
                              ? '返信'
                              : quoteToStatus
                                ? '引用'
                                : '新しい投稿'}
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
                    <ComposeAccountSelector
                        accounts={accounts}
                        composingAccount={composingAccount}
                        isLocked={isAccountLocked}
                        showSelector={showAccountSelector}
                        focusedIndex={focusedAccountIndex}
                        selectedAccountId={selectedAccountId}
                        listboxRef={listboxRef}
                        onSelectAccount={setSelectedAccountId}
                        onToggleSelector={setShowAccountSelector}
                        onSetFocusedIndex={setFocusedAccountIndex}
                    />

                    {/* Reply indicator */}
                    {replyToStatus && <ComposeReplyIndicator replyToStatus={replyToStatus} />}

                    {/* Quote indicator */}
                    {quoteToStatus && <ComposeQuoteIndicator quoteToStatus={quoteToStatus} />}

                    {/* CW, Media, and Poll buttons */}
                    <ComposeOptionButtons
                        showCW={showCW}
                        onToggleCW={() => setShowCW(!showCW)}
                        showEmojiPalette={showEmojiPalette}
                        onToggleEmojiPalette={() => setShowEmojiPalette(!showEmojiPalette)}
                        emojiButtonRef={emojiButtonRef}
                        hasMedia={hasMedia}
                        mediaCount={mediaFiles.length}
                        maxMedia={instanceConfig?.maxMediaAttachments ?? 4}
                        isUploading={isUploading}
                        showPoll={showPoll}
                        isEditMode={isEditMode}
                        onOpenFilePicker={() => fileInputRef.current?.click()}
                        onTogglePoll={togglePoll}
                        fileInputRef={fileInputRef}
                        acceptedMimeTypes={
                            instanceConfig?.supportedMimeTypes?.join(',') ??
                            getDefaultConfig().supportedMimeTypes.join(',')
                        }
                        onFileSelect={handleFileSelect}
                    />

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
                        <ComposePollForm
                            pollOptions={pollOptions}
                            pollExpiresIn={pollExpiresIn}
                            pollMultiple={pollMultiple}
                            durationOptions={POLL_DURATION_OPTIONS}
                            maxOptions={MAX_POLL_OPTIONS}
                            minOptions={MIN_POLL_OPTIONS}
                            onAddOption={addPollOption}
                            onRemoveOption={removePollOption}
                            onUpdateOption={updatePollOption}
                            onChangeExpiresIn={setPollExpiresIn}
                            onChangeMultiple={setPollMultiple}
                        />
                    )}

                    {/* Media Preview */}
                    <ComposeMediaPreview
                        mediaFiles={mediaFiles}
                        onRemove={removeMedia}
                        onUpdateAltText={updateAltText}
                        isSensitive={isSensitive}
                        onToggleSensitive={setIsSensitive}
                    />

                    {/* Text area */}
                    <ComposeTextarea
                        value={content}
                        onChange={setContent}
                        placeholder="今なにしてる？"
                        disabled={isSubmitting}
                        maxCharacters={instanceConfig?.maxCharacters ?? 500}
                        textareaRef={textareaRef}
                        onSubmit={handleSubmitClick}
                        isComposingRef={isComposingRef}
                    />

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
                    <ComposeVisibilitySelector
                        visibility={visibility}
                        isEditMode={isEditMode}
                        onChange={setVisibility}
                    />

                    {/* Error message */}
                    {error && (
                        <div
                            className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    {/* Emoji Palette */}
                    <EmojiPalette
                        isOpen={showEmojiPalette}
                        onClose={() => setShowEmojiPalette(false)}
                        onSelect={insertAtCursor}
                        session={composingAccount ?? null}
                        triggerRef={emojiButtonRef}
                        textareaRef={textareaRef}
                    />
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
                        onClick={handleSubmitClick}
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
