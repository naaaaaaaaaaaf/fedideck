import { useState } from 'react';
import type { mastodon } from 'masto';
import { LuX, LuRepeat2, LuMessageCircle, LuStar, LuLink, LuTriangleAlert } from 'react-icons/lu';
import { type AccountSession, type MastoClient, getClient, favouriteStatus, unfavouriteStatus, reblogStatus, unreblogStatus } from '../api/mastoClient';

interface StatusDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    status: mastodon.v1.Status | null;
    accountSession?: AccountSession;
    onReply?: (status: mastodon.v1.Status) => void;
}

function formatFullDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function StatusDetailModal({ isOpen, onClose, status, accountSession, onReply }: StatusDetailModalProps) {
    const [localFavourited, setLocalFavourited] = useState(false);
    const [localFavouritesCount, setLocalFavouritesCount] = useState(0);
    const [localReblogged, setLocalReblogged] = useState(false);
    const [localReblogsCount, setLocalReblogsCount] = useState(0);
    const [isLoading, setIsLoading] = useState({ favourite: false, reblog: false });

    // Sync local state when status changes
    if (status) {
        const displayStatus = status.reblog ?? status;
        if (localFavouritesCount !== (displayStatus.favouritesCount ?? 0) && !isLoading.favourite) {
            setLocalFavourited(displayStatus.favourited ?? false);
            setLocalFavouritesCount(displayStatus.favouritesCount ?? 0);
        }
        if (localReblogsCount !== (displayStatus.reblogsCount ?? 0) && !isLoading.reblog) {
            setLocalReblogged(displayStatus.reblogged ?? false);
            setLocalReblogsCount(displayStatus.reblogsCount ?? 0);
        }
    }

    if (!isOpen || !status) return null;

    const displayStatus = status.reblog ?? status;
    const reblogger = status.reblog ? status.account : null;
    const account = displayStatus.account;

    if (!account) return null;

    const mediaAttachments = displayStatus.mediaAttachments ?? [];
    const poll = displayStatus.poll;
    const canReblog = displayStatus.visibility !== 'private' && displayStatus.visibility !== 'direct';

    const handleFavourite = async () => {
        if (!accountSession || isLoading.favourite) return;

        setIsLoading(prev => ({ ...prev, favourite: true }));
        const wasLocalFavourited = localFavourited;
        setLocalFavourited(!wasLocalFavourited);
        setLocalFavouritesCount(prev => wasLocalFavourited ? prev - 1 : prev + 1);

        try {
            const client: MastoClient = getClient(accountSession);
            const updatedStatus = wasLocalFavourited
                ? await unfavouriteStatus(client, displayStatus.id)
                : await favouriteStatus(client, displayStatus.id);

            setLocalFavourited(updatedStatus.favourited ?? false);
            setLocalFavouritesCount(updatedStatus.favouritesCount ?? 0);
        } catch (error) {
            setLocalFavourited(wasLocalFavourited);
            setLocalFavouritesCount(prev => wasLocalFavourited ? prev + 1 : prev - 1);
            console.error('Failed to toggle favourite:', error);
        } finally {
            setIsLoading(prev => ({ ...prev, favourite: false }));
        }
    };

    const handleReblog = async () => {
        if (!accountSession || isLoading.reblog || !canReblog) return;

        setIsLoading(prev => ({ ...prev, reblog: true }));
        const wasLocalReblogged = localReblogged;
        setLocalReblogged(!wasLocalReblogged);
        setLocalReblogsCount(prev => wasLocalReblogged ? prev - 1 : prev + 1);

        try {
            const client: MastoClient = getClient(accountSession);
            const updatedStatus = wasLocalReblogged
                ? await unreblogStatus(client, displayStatus.id)
                : await reblogStatus(client, displayStatus.id);

            const actualStatus = updatedStatus.reblog ?? updatedStatus;
            setLocalReblogged(actualStatus.reblogged ?? false);
            setLocalReblogsCount(actualStatus.reblogsCount ?? 0);
        } catch (error) {
            setLocalReblogged(wasLocalReblogged);
            setLocalReblogsCount(prev => wasLocalReblogged ? prev + 1 : prev - 1);
            console.error('Failed to toggle reblog:', error);
        } finally {
            setIsLoading(prev => ({ ...prev, reblog: false }));
        }
    };

    const handleReply = () => {
        onReply?.(displayStatus);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl mx-4 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
                    <h2 className="text-lg font-semibold text-slate-100">投稿の詳細</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                    >
                        <LuX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {/* Reblog indicator */}
                    {reblogger && (
                        <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                            <LuRepeat2 className="text-green-400" />
                            <img
                                src={reblogger.avatar}
                                alt=""
                                className="w-5 h-5 rounded"
                            />
                            <span>{reblogger.displayName || reblogger.username} がブースト</span>
                        </div>
                    )}

                    {/* Author info */}
                    <div className="flex items-start gap-3 mb-4">
                        <a
                            href={account.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0"
                        >
                            <img
                                src={account.avatar}
                                alt={account.displayName || account.username}
                                className="w-14 h-14 rounded-xl hover:opacity-80 transition-opacity"
                            />
                        </a>
                        <div className="min-w-0 flex-1">
                            <a
                                href={account.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                            >
                                <span className="font-semibold text-lg text-slate-100 block">
                                    {account.displayName || account.username}
                                </span>
                                <span className="text-slate-400 block">
                                    @{account.acct}
                                </span>
                            </a>
                        </div>
                    </div>

                    {/* Content Warning */}
                    {displayStatus.spoilerText && (
                        <details className="mb-4" open>
                            <summary className="cursor-pointer text-amber-400 mb-2">
                                <LuTriangleAlert className="inline mr-1" /> {displayStatus.spoilerText}
                            </summary>
                            <div
                                className="text-slate-200 text-lg leading-relaxed status-content"
                                dangerouslySetInnerHTML={{ __html: displayStatus.content }}
                            />
                        </details>
                    )}

                    {/* Main content */}
                    {!displayStatus.spoilerText && (
                        <div
                            className="text-slate-200 text-lg leading-relaxed mb-4 status-content"
                            dangerouslySetInnerHTML={{ __html: displayStatus.content }}
                        />
                    )}

                    {/* Media attachments - larger display */}
                    {mediaAttachments.length > 0 && (
                        <div className={`mb-4 grid gap-2 ${mediaAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {mediaAttachments.slice(0, 4).map((media) => (
                                <a
                                    key={media.id}
                                    href={media.url ?? '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block overflow-hidden rounded-xl"
                                >
                                    {media.type === 'image' && (
                                        <img
                                            src={media.url ?? media.previewUrl ?? ''}
                                            alt={media.description ?? ''}
                                            className="w-full max-h-96 object-contain bg-slate-800 hover:opacity-90 transition-opacity"
                                        />
                                    )}
                                    {media.type === 'video' && (
                                        <video
                                            src={media.url ?? undefined}
                                            poster={media.previewUrl ?? undefined}
                                            className="w-full max-h-96 object-contain bg-slate-800"
                                            controls
                                        />
                                    )}
                                    {media.type === 'gifv' && (
                                        <video
                                            src={media.url ?? undefined}
                                            className="w-full max-h-96 object-contain bg-slate-800"
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                        />
                                    )}
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Poll */}
                    {poll && poll.options && poll.options.length > 0 && (
                        <div className="mb-4 p-4 bg-slate-800/50 rounded-xl">
                            {poll.options.map((option, i) => {
                                const votesCount = poll.votesCount ?? 0;
                                const percentage = votesCount > 0
                                    ? Math.round((option.votesCount ?? 0) / votesCount * 100)
                                    : 0;
                                return (
                                    <div key={i} className="mb-3 last:mb-0">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-200">{option.title}</span>
                                            <span className="text-slate-400">{percentage}%</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 transition-all rounded-full"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="text-sm text-slate-400 mt-3 pt-3 border-t border-slate-700">
                                {poll.votesCount ?? 0}票
                                {poll.expired && ' · 終了'}
                            </div>
                        </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-slate-400 text-sm mb-4 pb-4 border-b border-slate-700">
                        <a
                            href={displayStatus.url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                        >
                            {formatFullDate(displayStatus.createdAt)}
                        </a>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-slate-400 text-sm mb-4 pb-4 border-b border-slate-700">
                        <span><strong className="text-slate-200">{localReblogsCount}</strong> ブースト</span>
                        <span><strong className="text-slate-200">{localFavouritesCount}</strong> お気に入り</span>
                        {displayStatus.repliesCount > 0 && (
                            <span><strong className="text-slate-200">{displayStatus.repliesCount}</strong> 返信</span>
                        )}
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center justify-around text-slate-400">
                        <button
                            onClick={handleReply}
                            className="flex items-center gap-2 px-4 py-2 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                        >
                            <LuMessageCircle className="w-5 h-5" />
                            <span>返信</span>
                        </button>
                        <button
                            onClick={handleReblog}
                            disabled={!accountSession || isLoading.reblog || !canReblog}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${!canReblog
                                ? 'opacity-50 cursor-not-allowed'
                                : localReblogged
                                    ? 'text-green-400 hover:bg-green-400/10'
                                    : 'hover:text-green-400 hover:bg-green-400/10'
                                } ${isLoading.reblog ? 'opacity-50' : ''}`}
                            title={!canReblog ? 'この投稿はブーストできません' : undefined}
                        >
                            <LuRepeat2 className="w-5 h-5" />
                            <span>ブースト</span>
                        </button>
                        <button
                            onClick={handleFavourite}
                            disabled={!accountSession || isLoading.favourite}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${localFavourited
                                ? 'text-amber-400 hover:bg-amber-400/10'
                                : 'hover:text-amber-400 hover:bg-amber-400/10'
                                } ${isLoading.favourite ? 'opacity-50' : ''}`}
                        >
                            <LuStar className={`w-5 h-5 ${localFavourited ? 'fill-current' : ''}`} />
                            <span>お気に入り</span>
                        </button>
                        <a
                            href={displayStatus.url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                        >
                            <LuLink className="w-5 h-5" />
                            <span>リンク</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
