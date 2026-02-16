import { useEffect, useCallback, useRef, useMemo } from 'react';
import type { mastodon } from 'masto';
import { LuRefreshCw, LuX, LuTriangleAlert, LuInbox } from 'react-icons/lu';
import { getStreamDisplayName, getStreamIcon, type StreamConfig } from '../streaming/streamTypes';
import { StatusCard } from '../components/StatusCard';
import { NotificationCard } from '../components/NotificationCard';
import { useStreamsStore, getStreamKey } from '../store/streams';
import { useAccountsStore } from '../store/accounts';
import { getClient } from '../api/mastoClient';
import { formatAccountHandle } from '../utils/accountHandle';
import {
    fetchHomeTimeline,
    fetchPublicTimeline,
    fetchNotifications as fetchNotificationsAPI,
    fetchListTimeline,
    fetchHashtagTimeline,
} from '../api/mastoClient';
import { subscribeToStream, unsubscribeFromStream } from '../streaming/streamManager';
import type { ImageViewerImage } from '../components/ImageViewer';
import type { VideoViewerVideo } from '../types/video';
import type { AudioViewerTrack } from '../types/audio';

interface ColumnProps {
    id: string;
    accountId: string;
    stream: StreamConfig;
    onRemove?: () => void;
    onReply?: (status: mastodon.v1.Status, accountSessionId: string) => void;
    onStatusClick?: (status: mastodon.v1.Status, accountSessionId: string) => void;
    onImageClick?: (images: ImageViewerImage[], index: number) => void;
    onVideoClick?: (videos: VideoViewerVideo[], index: number) => void;
    onAudioClick?: (tracks: AudioViewerTrack[], index: number) => void;
    onAccountClick?: (account: mastodon.v1.Account, accountSessionId: string | undefined) => void;
    onNsfwReveal?: (statusId: string) => void;
    nsfwRevealedStatusIds?: Set<string>;
    onStatusDelete?: (status: mastodon.v1.Status, accountId: string) => void;
    onStatusEdit?: (status: mastodon.v1.Status, accountSessionId: string) => void;
}

export function Column({
    accountId,
    stream,
    onRemove,
    onReply,
    onStatusClick,
    onImageClick,
    onVideoClick,
    onAudioClick,
    onAccountClick,
    onNsfwReveal,
    nsfwRevealedStatusIds,
    onStatusDelete,
    onStatusEdit,
}: ColumnProps) {
    const account = useAccountsStore((state) => state.accounts.find((a) => a.id === accountId));
    const streamKey = getStreamKey(accountId, stream.type, stream);
    const data = useStreamsStore((state) => state.data[streamKey]);
    // Use selectors to prevent cascade re-renders when stream updates occur
    const initStream = useStreamsStore((s) => s.initStream);
    const setLoading = useStreamsStore((s) => s.setLoading);
    const setStatuses = useStreamsStore((s) => s.setStatuses);
    const setNotifications = useStreamsStore((s) => s.setNotifications);
    const appendStatuses = useStreamsStore((s) => s.appendStatuses);
    const appendNotifications = useStreamsStore((s) => s.appendNotifications);
    const setError = useStreamsStore((s) => s.setError);
    const updateStatusGlobal = useStreamsStore((s) => s.updateStatusGlobal);

    const scrollRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const isNotificationColumn = stream.type === 'notifications';

    // Stable callback wrappers to prevent React.memo invalidation in card components
    // Using useMemo instead of useCallback to safely handle undefined values
    const handleStatusClick = useMemo(
        () =>
            onStatusClick
                ? (status: mastodon.v1.Status) => onStatusClick(status, accountId)
                : undefined,
        [onStatusClick, accountId]
    );
    const handleAccountClick = useMemo(
        () =>
            onAccountClick
                ? (acc: mastodon.v1.Account) => onAccountClick(acc, accountId)
                : undefined,
        [onAccountClick, accountId]
    );
    const handleReply = useMemo(
        () => (onReply ? (status: mastodon.v1.Status) => onReply(status, accountId) : undefined),
        [onReply, accountId]
    );
    const handleStatusDelete = useMemo(
        () =>
            onStatusDelete
                ? (status: mastodon.v1.Status) => onStatusDelete(status, accountId)
                : undefined,
        [onStatusDelete, accountId]
    );
    const handleStatusEdit = useMemo(
        () =>
            onStatusEdit
                ? (status: mastodon.v1.Status) => onStatusEdit(status, accountId)
                : undefined,
        [onStatusEdit, accountId]
    );

    // Define loadInitialData before useEffect that uses it
    const loadInitialData = useCallback(async () => {
        if (!account) return;

        setLoading(streamKey, true);

        try {
            const client = getClient(account);

            if (isNotificationColumn) {
                const notifications = await fetchNotificationsAPI(client);
                setNotifications(streamKey, notifications);
            } else {
                let statuses: mastodon.v1.Status[] = [];

                switch (stream.type) {
                    case 'home':
                        statuses = await fetchHomeTimeline(client);
                        break;
                    case 'public':
                        statuses = await fetchPublicTimeline(client, { local: false });
                        break;
                    case 'public:local':
                        statuses = await fetchPublicTimeline(client, { local: true });
                        break;
                    case 'list':
                        if (stream.listId) {
                            statuses = await fetchListTimeline(client, stream.listId);
                        }
                        break;
                    case 'hashtag':
                        if (stream.hashtag) {
                            statuses = await fetchHashtagTimeline(client, stream.hashtag);
                        }
                        break;
                }

                setStatuses(streamKey, statuses);
            }
        } catch (error) {
            console.error('Failed to load timeline:', error);
            setError(streamKey, (error as Error).message);
        }
    }, [
        account,
        streamKey,
        stream,
        isNotificationColumn,
        setLoading,
        setNotifications,
        setStatuses,
        setError,
    ]);

    const loadMore = useCallback(async () => {
        if (!account || !data || data.isLoading || !data.hasMore) return;

        setLoading(streamKey, true);

        try {
            const client = getClient(account);

            if (isNotificationColumn) {
                const lastId = data.notifications[data.notifications.length - 1]?.id;
                if (!lastId) return;

                const notifications = await fetchNotificationsAPI(client, { maxId: lastId });
                appendNotifications(streamKey, notifications);
            } else {
                const lastId = data.statuses[data.statuses.length - 1]?.id;
                if (!lastId) return;

                let statuses: mastodon.v1.Status[] = [];

                switch (stream.type) {
                    case 'home':
                        statuses = await fetchHomeTimeline(client, { maxId: lastId });
                        break;
                    case 'public':
                        statuses = await fetchPublicTimeline(client, {
                            local: false,
                            maxId: lastId,
                        });
                        break;
                    case 'public:local':
                        statuses = await fetchPublicTimeline(client, {
                            local: true,
                            maxId: lastId,
                        });
                        break;
                    case 'list':
                        if (stream.listId) {
                            statuses = await fetchListTimeline(client, stream.listId, {
                                maxId: lastId,
                            });
                        }
                        break;
                    case 'hashtag':
                        if (stream.hashtag) {
                            statuses = await fetchHashtagTimeline(client, stream.hashtag, {
                                maxId: lastId,
                            });
                        }
                        break;
                }

                appendStatuses(streamKey, statuses);
            }
        } catch (error) {
            console.error('Failed to load more:', error);
        }
    }, [
        account,
        data,
        streamKey,
        stream,
        isNotificationColumn,
        setLoading,
        appendNotifications,
        appendStatuses,
    ]);

    // Initialize and load data
    useEffect(() => {
        if (!account) return;

        initStream(streamKey);
        loadInitialData();

        // Subscribe to streaming
        subscribeToStream(accountId, account.instanceUrl, account.accessToken, stream);

        return () => {
            unsubscribeFromStream(accountId, stream);
        };
    }, [accountId, account, stream, streamKey, initStream, loadInitialData]);

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [loadMore]);

    const accountHandle = account ? formatAccountHandle(account) : null;

    return (
        <div className="flex flex-col h-full w-80 min-w-80 bg-slate-900/80 backdrop-blur-sm border-r border-slate-700/50 shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-lg shrink-0">{getStreamIcon(stream.type)}</span>
                    <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-100 truncate">
                            {getStreamDisplayName(stream)}
                        </div>
                        {accountHandle && (
                            <div className="text-xs text-slate-400 truncate" title={accountHandle}>
                                {accountHandle}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={loadInitialData}
                        className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                        title="更新"
                    >
                        <LuRefreshCw />
                    </button>
                    {onRemove && (
                        <button
                            onClick={onRemove}
                            className="p-1.5 hover:bg-red-900/50 rounded-lg transition-colors text-slate-400 hover:text-red-400"
                            title="カラムを削除"
                        >
                            <LuX />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
                {/* Error state */}
                {data?.error && (
                    <div className="p-4 text-center">
                        <div className="text-red-400 mb-2 flex items-center gap-2">
                            <LuTriangleAlert /> エラー
                        </div>
                        <div className="text-sm text-slate-400">{data.error}</div>
                        <button
                            onClick={loadInitialData}
                            className="mt-3 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm transition-colors"
                        >
                            再試行
                        </button>
                    </div>
                )}

                {/* Loading state */}
                {data?.isLoading && !data.statuses.length && !data.notifications.length && (
                    <div className="p-4 text-center text-slate-400">
                        <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-600 border-t-indigo-500 rounded-full"></div>
                        <div className="mt-2 text-sm">読み込み中...</div>
                    </div>
                )}

                {/* Notifications */}
                {isNotificationColumn &&
                    data?.notifications.map((notification) => {
                        // Get the display status ID for NSFW check (handle reblog case)
                        const displayStatus = notification.status?.reblog ?? notification.status;
                        const statusId = displayStatus?.id;

                        return (
                            <NotificationCard
                                key={notification.id}
                                notification={notification}
                                onStatusClick={handleStatusClick}
                                onAccountClick={handleAccountClick}
                                onNsfwToggle={onNsfwReveal}
                                isNsfwRevealed={
                                    statusId
                                        ? (nsfwRevealedStatusIds?.has(statusId) ?? false)
                                        : false
                                }
                            />
                        );
                    })}

                {/* Statuses */}
                {!isNotificationColumn &&
                    data?.statuses.map((status) => {
                        // Get the display status ID for NSFW check (handle reblog case)
                        const displayStatus = status.reblog ?? status;

                        return (
                            <StatusCard
                                key={status.id}
                                status={status}
                                accountSession={account}
                                onStatusUpdate={updateStatusGlobal}
                                onReply={handleReply}
                                onStatusClick={handleStatusClick}
                                onImageClick={onImageClick}
                                onVideoClick={onVideoClick}
                                onAudioClick={onAudioClick}
                                onAccountClick={handleAccountClick}
                                onNsfwToggle={onNsfwReveal}
                                isNsfwRevealed={
                                    nsfwRevealedStatusIds?.has(displayStatus.id) ?? false
                                }
                                onStatusDelete={handleStatusDelete}
                                onStatusEdit={handleStatusEdit}
                            />
                        );
                    })}

                {/* Load more trigger */}
                {data?.hasMore && (data.statuses.length > 0 || data.notifications.length > 0) && (
                    <div ref={loadMoreRef} className="p-4 text-center">
                        {data.isLoading ? (
                            <div className="animate-spin inline-block w-5 h-5 border-2 border-slate-600 border-t-indigo-500 rounded-full"></div>
                        ) : (
                            <button
                                onClick={loadMore}
                                className="text-sm text-indigo-400 hover:text-indigo-300"
                            >
                                もっと読み込む
                            </button>
                        )}
                    </div>
                )}

                {/* Empty state */}
                {!data?.isLoading &&
                    !data?.error &&
                    ((isNotificationColumn && !data?.notifications.length) ||
                        (!isNotificationColumn && !data?.statuses.length)) && (
                        <div className="p-8 text-center text-slate-400">
                            <LuInbox className="text-4xl mb-3" />
                            <div>まだ投稿がありません</div>
                        </div>
                    )}
            </div>
        </div>
    );
}
