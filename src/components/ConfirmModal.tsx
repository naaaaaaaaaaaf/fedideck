import { useRef } from 'react';
import { LuX } from 'react-icons/lu';
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
    /** Whether this modal is the active (top-most) overlay */
    isActive?: boolean;
    zIndex?: number;
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
    isActive = true,
    zIndex,
}: ConfirmModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    const { handleKeyDown, handleBackdropClick } = useModalAccessibility({
        isOpen: isOpen && isActive,
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
            className="fixed inset-0 flex items-center justify-center"
            style={zIndex != null ? { zIndex } : undefined}
            onKeyDown={isActive ? handleKeyDown : undefined}
            role="dialog"
            aria-modal={isActive ? 'true' : undefined}
            aria-hidden={!isActive ? true : undefined}
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-message"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative w-full max-w-md mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                    <h2 id="confirm-modal-title" className="text-lg font-semibold text-slate-100">
                        {title}
                    </h2>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50"
                        aria-label="閉じる"
                    >
                        <LuX className="w-5 h-5" aria-hidden="true" />
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
                <div className="flex justify-end gap-3 px-4 py-3 border-t border-slate-700/50 bg-slate-800/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${confirmButtonClass}`}
                    >
                        {isLoading ? '処理中...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
