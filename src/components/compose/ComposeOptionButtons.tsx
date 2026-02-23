import { type RefObject } from 'react';
import { LuTriangleAlert, LuImage, LuListOrdered, LuSmile } from 'react-icons/lu';
import type { InstanceConfig } from '../../api/instanceConfig';
import { getDefaultConfig } from '../../api/instanceConfig';
import { EmojiPalette } from '../EmojiPalette';
import type { AccountSession } from '../../api/mastoClient';

interface ComposeOptionButtonsProps {
    showCW: boolean;
    onToggleCW: () => void;
    showEmojiPalette: boolean;
    onToggleEmojiPalette: () => void;
    emojiButtonRef: RefObject<HTMLButtonElement | null>;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    composingAccount: AccountSession | null | undefined;
    insertAtCursor: (text: string) => void;
    hasMedia: boolean;
    mediaCount: number;
    instanceConfig: InstanceConfig | null;
    isUploading: boolean;
    showPoll: boolean;
    isEditMode: boolean;
    onOpenFilePicker: () => void;
    onTogglePoll: () => void;
    fileInputRef: RefObject<HTMLInputElement | null>;
}

/**
 * Option buttons component for compose modal
 * Includes CW, emoji, media, and poll toggles
 */
export function ComposeOptionButtons({
    showCW,
    onToggleCW,
    showEmojiPalette,
    onToggleEmojiPalette,
    emojiButtonRef,
    textareaRef,
    composingAccount,
    insertAtCursor,
    hasMedia,
    mediaCount,
    instanceConfig,
    isUploading,
    showPoll,
    isEditMode,
    onOpenFilePicker,
    onTogglePoll,
    fileInputRef,
}: ComposeOptionButtonsProps) {
    const maxMedia = instanceConfig?.maxMediaAttachments ?? getDefaultConfig().maxMediaAttachments;
    const supportedMimeTypes =
        instanceConfig?.supportedMimeTypes ?? getDefaultConfig().supportedMimeTypes;

    return (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="投稿オプション">
            <button
                onClick={onToggleCW}
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
                    onClick={onToggleEmojiPalette}
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
                    onClose={() => onToggleEmojiPalette()}
                    onSelect={insertAtCursor}
                    session={composingAccount ?? null}
                    triggerRef={emojiButtonRef}
                    textareaRef={textareaRef}
                />
            </div>

            <button
                onClick={onOpenFilePicker}
                disabled={mediaCount >= maxMedia || isUploading || showPoll}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    hasMedia
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={`メディアを追加${hasMedia ? ` (${mediaCount}/${maxMedia})` : ''}`}
            >
                <LuImage className="w-4 h-4" aria-hidden="true" />
                画像/動画/音声
                {hasMedia && (
                    <span className="text-xs">
                        ({mediaCount}/{maxMedia})
                    </span>
                )}
            </button>

            <button
                onClick={onTogglePoll}
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
                accept={supportedMimeTypes.join(',')}
                multiple
                onChange={() => {}}
                className="hidden"
                aria-hidden="true"
            />
        </div>
    );
}
