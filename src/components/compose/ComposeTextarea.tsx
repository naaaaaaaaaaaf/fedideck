import { type RefObject, type MutableRefObject } from 'react';

interface ComposeTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    disabled: boolean;
    maxCharacters: number;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    onSubmit: () => void;
    isComposingRef?: MutableRefObject<boolean>;
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
    textareaRef,
    onSubmit,
    isComposingRef,
}: ComposeTextareaProps) {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isSubmitShortcut = e.key === 'Enter' && (e.ctrlKey || e.metaKey);
        if (!isSubmitShortcut) return;

        // Don't submit during IME composition or key repeat
        // Use both native isComposing and ref tracking for Safari compatibility
        if (e.nativeEvent.isComposing || (isComposingRef?.current ?? false) || e.repeat) return;

        e.preventDefault();
        onSubmit();
    };

    const handleCompositionStart = () => {
        if (isComposingRef) {
            isComposingRef.current = true;
        }
    };

    const handleCompositionEnd = () => {
        if (isComposingRef) {
            isComposingRef.current = false;
        }
    };

    return (
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
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder={placeholder}
                rows={6}
                disabled={disabled}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            />
        </div>
    );
}
