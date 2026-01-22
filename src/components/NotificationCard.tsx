import type { mastodon } from 'masto';
import type { ReactNode } from 'react';
import {
    LuMessageCircle,
    LuRepeat2,
    LuStar,
    LuUserPlus,
    LuUserCheck,
    LuChartBar,
    LuFileText,
    LuPencil,
    LuPartyPopper,
    LuCircleAlert,
    LuBell,
    LuTriangleAlert
} from 'react-icons/lu';

interface NotificationCardProps {
    notification: mastodon.v1.Notification;
}

export function NotificationCard({ notification }: NotificationCardProps) {
    const formatDate = (dateStr: string) => {
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
    };

    const getNotificationInfo = (): { icon: ReactNode; label: string; color: string } => {
        switch (notification.type) {
            case 'mention':
                return { icon: <LuMessageCircle />, label: 'メンション', color: 'text-blue-400' };
            case 'reblog':
                return { icon: <LuRepeat2 />, label: 'ブースト', color: 'text-green-400' };
            case 'favourite':
                return { icon: <LuStar />, label: 'お気に入り', color: 'text-amber-400' };
            case 'follow':
                return { icon: <LuUserPlus />, label: 'フォロー', color: 'text-purple-400' };
            case 'follow_request':
                return { icon: <LuUserCheck />, label: 'フォローリクエスト', color: 'text-purple-400' };
            case 'poll':
                return { icon: <LuChartBar />, label: '投票終了', color: 'text-indigo-400' };
            case 'status':
                return { icon: <LuFileText />, label: '新規投稿', color: 'text-slate-400' };
            case 'update':
                return { icon: <LuPencil />, label: '編集', color: 'text-slate-400' };
            case 'admin.sign_up':
                return { icon: <LuPartyPopper />, label: '新規登録', color: 'text-emerald-400' };
            case 'admin.report':
                return { icon: <LuCircleAlert />, label: '通報', color: 'text-red-400' };
            default:
                return { icon: <LuBell />, label: notification.type, color: 'text-slate-400' };
        }
    };

    const info = getNotificationInfo();
    const account = notification.account;
    const status = notification.status;

    return (
        <article className="p-4 border-b border-slate-700/50 card-hover animate-fade-in">
            {/* Notification header */}
            <div className="flex items-center gap-3 mb-2">
                <span className={`text-lg ${info.color}`}>{info.icon}</span>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <a
                        href={account.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                    >
                        <img
                            src={account.avatar}
                            alt=""
                            className="w-6 h-6 rounded"
                        />
                    </a>
                    <span className="text-sm truncate">
                        <a
                            href={account.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-slate-100 hover:underline"
                        >
                            {account.displayName || account.username}
                        </a>
                        <span className="text-slate-400"> さんが{info.label}</span>
                    </span>
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                    {formatDate(notification.createdAt)}
                </span>
            </div>

            {/* Follow notification - show account info */}
            {(notification.type === 'follow' || notification.type === 'follow_request') && (
                <div className="ml-9 p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-start gap-3">
                        <img
                            src={account.avatar}
                            alt=""
                            className="w-12 h-12 rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-100 truncate">
                                {account.displayName || account.username}
                            </div>
                            <div className="text-sm text-slate-400 truncate">
                                @{account.acct}
                            </div>
                            {account.note && (
                                <div
                                    className="text-sm text-slate-300 mt-1 line-clamp-2"
                                    dangerouslySetInnerHTML={{ __html: account.note }}
                                />
                            )}
                        </div>
                    </div>
                    {notification.type === 'follow_request' && (
                        <div className="flex gap-2 mt-3 ml-15">
                            <button className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm transition-colors">
                                承認
                            </button>
                            <button className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">
                                拒否
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Status-related notifications */}
            {status && (
                <div className="ml-9 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
                    {status.spoilerText ? (
                        <details>
                            <summary className="cursor-pointer text-amber-400 text-sm">
                                <LuTriangleAlert className="inline mr-1" /> {status.spoilerText}
                            </summary>
                            <div
                                className="mt-2 text-sm text-slate-300 wrap-break-word"
                                dangerouslySetInnerHTML={{ __html: status.content }}
                            />
                        </details>
                    ) : (
                        <div
                            className="text-sm text-slate-300 wrap-break-word line-clamp-4"
                            dangerouslySetInnerHTML={{ __html: status.content }}
                        />
                    )}

                    {/* Media indicator */}
                    {status.mediaAttachments.length > 0 && (
                        <div className="flex gap-1 mt-2">
                            {status.mediaAttachments.slice(0, 4).map((media) => (
                                <img
                                    key={media.id}
                                    src={media.previewUrl ?? media.url}
                                    alt=""
                                    className="w-12 h-12 rounded object-cover"
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}
