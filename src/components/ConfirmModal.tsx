import { useRef } from 'react';
import { useModalAccessibility } from '../hooks/useModalAccessibility';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
    isLoading?: boolean;
    error?: string | null;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = '確認',
    cancelLabel = 'キャンセル',
    variant = 'default',
    isLoading = false,
    error = null,
}: ConfirmModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    const { handleKeyDown } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
        canClose: !isLoading,
    });

    if (!isOpen) return null;

    const confirmButtonClass =
        variant === 'danger'
            ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-600/50'
            : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50';

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onKeyDown={handleKeyDown}
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                aria-describedby="confirm-modal-message"
                className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                    <h2 id="confirm-modal-title" className="text-lg font-semibold text-slate-100">
                        {title}
                    </h2>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                        aria-label="閉じる"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="px-4 py-4">
                    <p id="confirm-modal-message" className="text-slate-300">
                        {message}
                    </p>

                    {/* Error message */}
                    {error && (
                        <div className="mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 px-4 py-3 border-t border-slate-700 bg-slate-800/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm text-white rounded transition-colors ${confirmButtonClass}`}
                    >
                        {isLoading ? '処理中...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
