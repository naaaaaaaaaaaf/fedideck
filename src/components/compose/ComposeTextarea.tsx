import { type RefObject } from 'react';

interface ComposeTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    disabled: boolean;
    maxCharacters: number;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    onSubmit: () => void;
    onPaste?: (e: React.ClipboardEvent) => void;
    onCompositionStart?: () => void;
    onCompositionEnd?: () => void;
}

/**
 * Textarea component for compose modal
 * Handles IME composition and keyboard shortcuts
 */
export function ComposeTextarea({
    value,
    onChange,
    placeholder,
    disabled,
    maxCharacters,
    textareaRef,
    onSubmit,
    onPaste,
    onCompositionStart,
    onCompositionEnd,
}: ComposeTextareaProps) {
    const remainingChars = maxCharacters - value.length;
    const isOverLimit = remainingChars < 0;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isSubmitShortcut = e.key === 'Enter' && (e.ctrlKey || e.metaKey);
        if (!isSubmitShortcut) return;

        // Don't submit during IME composition or key repeat
        if (e.nativeEvent.isComposing || e.repeat) return;

        e.preventDefault();
        onSubmit();
    };

    return (
        <>
            <div>
                <label htmlFor="compose-content" className="sr-only">
                    投稿内容
                </label>
                <textarea
                    ref={textareaRef}
                    id="compose-content"
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onPaste={onPaste}
                    onCompositionStart={onCompositionStart}
                    onCompositionEnd={onCompositionEnd}
                    placeholder={placeholder}
                    rows={6}
                    disabled={disabled}
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
        </>
    );
}
