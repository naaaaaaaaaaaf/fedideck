import { useState, useEffect, useRef } from 'react';
import type { mastodon } from 'masto';
import { LuX, LuLoader, LuUser, LuUsers, LuFileText } from 'react-icons/lu';
import { type AccountSession, type MastoClient, getClient, fetchAccount } from '../api/mastoClient';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { replaceEmojisWithImages } from '../utils/emoji';
import { DisplayName } from './DisplayName';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: mastodon.v1.Account | null;
    accountSession?: AccountSession;
}

export function ProfileModal({ isOpen, onClose, account, accountSession }: ProfileModalProps) {
    const [fullAccount, setFullAccount] = useState<mastodon.v1.Account | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs for focus management
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    const { handleKeyDown } = useModalAccessibility({
        isOpen,
        onClose,
        closeButtonRef,
        modalRef,
    });

    // Reset state when modal closes or account changes, then fetch if available
    useEffect(() => {
        // Reset state when modal closes
        if (!isOpen) {
            setFullAccount(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        // Reset state when account changes (modal stays open but different account)
        setFullAccount(null);
        setError(null);

        // Only fetch if we have both account and session
        if (!account || !accountSession) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const fetchFullAccount = async () => {
            setIsLoading(true);

            try {
                const client: MastoClient = getClient(accountSession);
                const fetched = await fetchAccount(client, account.id);
                if (!cancelled) {
                    setFullAccount(fetched);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to fetch account:', err);
                    setError('プロフィールの読み込みに失敗しました');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchFullAccount();

        return () => {
            cancelled = true;
        };
    }, [isOpen, account?.id, accountSession?.id]);

    if (!isOpen || !account) {
        return null;
    }

    const displayAccount = fullAccount ?? account;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative w-full max-w-md mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden max-h-[90vh] flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
                    <h2 id="profile-modal-title" className="text-lg font-semibold text-slate-100">
                        プロフィール
                    </h2>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                        aria-label="閉じる"
                    >
                        <LuX className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* Loading indicator */}
                    {isLoading && !fullAccount && (
                        <div className="flex items-center justify-center py-8 text-slate-400">
                            <LuLoader className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />
                            <span>プロフィールを読み込み中...</span>
                        </div>
                    )}

                    {/* Error message */}
                    {error && !fullAccount && (
                        <div className="text-center py-8 text-slate-500 text-sm">{error}</div>
                    )}

                    {/* Profile content */}
                    {displayAccount && (
                        <div className="flex flex-col items-center text-center">
                            {/* Avatar */}
                            <img
                                src={displayAccount.avatar}
                                alt={displayAccount.displayName || displayAccount.username}
                                className="w-20 h-20 rounded-full mb-4"
                            />

                            {/* Display name and username */}
                            <DisplayName
                                account={displayAccount}
                                className="text-xl font-semibold text-slate-100 block mb-1"
                            />
                            <span className="text-slate-400 text-sm mb-4">
                                @{displayAccount.acct}
                            </span>

                            {/* Bio */}
                            {displayAccount.note && (
                                <div
                                    className="text-slate-300 text-sm mb-6 wrap-break-word profile-bio"
                                    dangerouslySetInnerHTML={{
                                        __html: replaceEmojisWithImages(
                                            displayAccount.note,
                                            displayAccount.emojis ?? []
                                        ),
                                    }}
                                />
                            )}

                            {/* Stats */}
                            <div className="flex items-center justify-center gap-6 text-slate-400 text-sm w-full border-t border-slate-700/50 pt-4">
                                <div className="flex items-center gap-2">
                                    <LuFileText className="w-4 h-4" aria-hidden="true" />
                                    <span>
                                        <strong className="text-slate-200">
                                            {displayAccount.statusesCount}
                                        </strong>{' '}
                                        投稿
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <LuUsers className="w-4 h-4" aria-hidden="true" />
                                    <span>
                                        <strong className="text-slate-200">
                                            {displayAccount.followersCount}
                                        </strong>{' '}
                                        フォロワー
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <LuUser className="w-4 h-4" aria-hidden="true" />
                                    <span>
                                        <strong className="text-slate-200">
                                            {displayAccount.followingCount}
                                        </strong>{' '}
                                        フォロー中
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
