import type { mastodon } from 'masto';
import { LuRepeat2, LuMessageCircle, LuStar, LuLink, LuTriangleAlert } from 'react-icons/lu';

interface StatusCardProps {
    status: mastodon.v1.Status;
    isReblog?: boolean;
}

/**
 * Format a date string to relative time in Japanese
 */
function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '今';
    if (diffMins < 60) return `${diffMins}分`;
    if (diffHours < 24) return `${diffHours}時間`;
    if (diffDays < 7) return `${diffDays}日`;
    return date.toLocaleDateString('ja-JP');
}

export function StatusCard({ status, isReblog = false }: StatusCardProps) {
    // If it's a reblog, show the original status with reblog indicator
    const displayStatus = status.reblog ?? status;
    const reblogger = status.reblog ? status.account : null;

    // Safely access arrays with fallbacks
    const mediaAttachments = displayStatus.mediaAttachments ?? [];
    const poll = displayStatus.poll;

    // Safely access account
    const account = displayStatus.account;
    if (!account) {
        return null; // Cannot render without account
    }

    return (
        <article className={`p-4 border-b border-slate-700/50 card-hover ${isReblog ? 'animate-fade-in' : ''}`}>
            {/* Reblog indicator */}
            {reblogger && (
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2 ml-12">
                    <LuRepeat2 className="text-green-400" />
                    <img
                        src={reblogger.avatar}
                        alt=""
                        className="w-4 h-4 rounded"
                    />
                    <span className="truncate">{reblogger.displayName || reblogger.username} がブースト</span>
                </div>
            )}

            <div className="flex gap-3">
                {/* Avatar */}
                <a
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                >
                    <img
                        src={account.avatar}
                        alt={account.displayName || account.username}
                        className="w-12 h-12 rounded-lg hover:opacity-80 transition-opacity"
                    />
                </a>

                {/* Content */}
                <div className="min-w-0 flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <a
                                href={account.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                            >
                                <span className="font-semibold text-slate-100 block truncate">
                                    {account.displayName || account.username}
                                </span>
                                <span className="text-sm text-slate-400 block truncate">
                                    @{account.acct}
                                </span>
                            </a>
                        </div>
                        <a
                            href={displayStatus.url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-slate-400 hover:text-slate-300 shrink-0"
                        >
                            {formatDate(displayStatus.createdAt)}
                        </a>
                    </div>

                    {/* Content Warning */}
                    {displayStatus.spoilerText && (
                        <details className="mt-2">
                            <summary className="cursor-pointer text-amber-400 text-sm">
                                <LuTriangleAlert className="inline mr-1" /> {displayStatus.spoilerText}
                            </summary>
                            <div
                                className="mt-2 text-slate-200 break-words status-content"
                                dangerouslySetInnerHTML={{ __html: displayStatus.content }}
                            />
                        </details>
                    )}

                    {/* Main content */}
                    {!displayStatus.spoilerText && (
                        <div
                            className="mt-2 text-slate-200 break-words status-content"
                            dangerouslySetInnerHTML={{ __html: displayStatus.content }}
                        />
                    )}

                    {/* Media attachments - safely check length */}
                    {mediaAttachments.length > 0 && (
                        <div className={`mt-3 grid gap-1 ${mediaAttachments.length === 1 ? 'grid-cols-1' :
                            mediaAttachments.length >= 2 ? 'grid-cols-2' : 'grid-cols-2'
                            }`}>
                            {mediaAttachments.slice(0, 4).map((media) => (
                                <a
                                    key={media.id}
                                    href={media.url ?? '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block overflow-hidden rounded-lg"
                                >
                                    {media.type === 'image' && (
                                        <img
                                            src={media.previewUrl ?? media.url ?? ''}
                                            alt={media.description ?? ''}
                                            className="w-full h-36 object-cover hover:opacity-90 transition-opacity"
                                        />
                                    )}
                                    {media.type === 'video' && (
                                        <video
                                            src={media.url ?? undefined}
                                            poster={media.previewUrl ?? undefined}
                                            className="w-full h-36 object-cover"
                                            controls
                                        />
                                    )}
                                    {media.type === 'gifv' && (
                                        <video
                                            src={media.url ?? undefined}
                                            className="w-full h-36 object-cover"
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

                    {/* Poll - safely check existence and options */}
                    {poll && poll.options && poll.options.length > 0 && (
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                            {poll.options.map((option, i) => {
                                const votesCount = poll.votesCount ?? 0;
                                const percentage = votesCount > 0
                                    ? Math.round((option.votesCount ?? 0) / votesCount * 100)
                                    : 0;
                                return (
                                    <div key={i} className="mb-2 last:mb-0">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>{option.title}</span>
                                            <span className="text-slate-400">{percentage}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-700 rounded overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 transition-all"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="text-xs text-slate-400 mt-2">
                                {poll.votesCount ?? 0}票
                                {poll.expired && ' · 終了'}
                            </div>
                        </div>
                    )}

                    {/* Action bar */}
                    <div className="flex items-center gap-6 mt-3 text-slate-400">
                        <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                            <LuMessageCircle />
                            <span className="text-sm">{displayStatus.repliesCount || ''}</span>
                        </button>
                        <button className={`flex items-center gap-1.5 hover:text-green-400 transition-colors ${displayStatus.reblogged ? 'text-green-400' : ''}`}>
                            <LuRepeat2 />
                            <span className="text-sm">{displayStatus.reblogsCount || ''}</span>
                        </button>
                        <button className={`flex items-center gap-1.5 hover:text-pink-400 transition-colors ${displayStatus.favourited ? 'text-pink-400' : ''}`}>
                            <LuStar />
                            <span className="text-sm">{displayStatus.favouritesCount || ''}</span>
                        </button>
                        <button className="hover:text-indigo-400 transition-colors">
                            <LuLink />
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}

// Export for testing
export { formatDate };
