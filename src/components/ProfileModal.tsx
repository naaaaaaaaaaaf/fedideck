import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { mastodon } from 'masto';
import {
    LuX,
    LuLoader,
    LuUser,
    LuUsers,
    LuFileText,
    LuUserPlus,
    LuUserMinus,
    LuCircleAlert,
    LuRefreshCw,
} from 'react-icons/lu';
import {
    type AccountSession,
    type MastoClient,
    getClient,
    fetchAccount,
    fetchAccountStatuses,
    fetchAccountFollowers,
    fetchAccountFollowing,
} from '../api/mastoClient';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { useRelationshipActions } from '../hooks/useRelationshipActions';
import { useInstanceConfig } from '../hooks/useInstanceConfig';
import { replaceEmojisWithImages } from '../utils/emoji';
import { DisplayName } from './DisplayName';
import { StatusCard } from './StatusCard';
import { UserListItem } from './UserListItem';
import type { ImageViewerImage } from './ImageViewer';
import type { VideoViewerVideo } from '../types/video';
import type { AudioViewerTrack } from '../types/audio';

const PAGE_SIZE = 20;

/** Tab type for profile modal */
type ProfileTab = 'posts' | 'followers' | 'following';

/** Tab order for keyboard navigation */
const TAB_ORDER: ProfileTab[] = ['posts', 'followers', 'following'];

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: mastodon.v1.Account | null;
    accountSession?: AccountSession;
    onReply?: (status: mastodon.v1.Status, accountSessionId: string) => void;
    onQuote?: (status: mastodon.v1.Status, accountSessionId: string) => void;
    onStatusClick?: (status: mastodon.v1.Status, accountSessionId: string) => void;
    onImageClick?: (images: ImageViewerImage[], index: number) => void;
    onVideoClick?: (videos: VideoViewerVideo[], index: number) => void;
    onAudioClick?: (tracks: AudioViewerTrack[], index: number) => void;
    onAccountClick?: (account: mastodon.v1.Account, accountSessionId: string | undefined) => void;
    onNsfwReveal?: (statusId: string) => void;
    nsfwRevealedStatusIds?: Set<string>;
    onStatusUpdate?: (updatedStatus: mastodon.v1.Status) => void;
    onStatusDelete?: (status: mastodon.v1.Status, accountSessionId: string) => void;
    onStatusEdit?: (status: mastodon.v1.Status, accountSessionId: string) => void;
    supportsQuotes?: boolean;
    /** Reference to a deleted status (scoped by account) to remove from local list */
    deletedStatusRef?: { statusId: string; accountSessionId: string };
    /** Called when this modal has consumed the deleted status ref */
    onDeletedStatusConsumed?: () => void;
    /** Whether this modal is the active (top-most) modal that should capture focus and handle Escape */
    isActive?: boolean;
    zIndex?: number;
}

export function ProfileModal({
    isOpen,
    onClose,
    account,
    accountSession,
    onReply,
    onQuote,
    onStatusClick,
    onImageClick,
    onVideoClick,
    onAudioClick,
    onAccountClick,
    onNsfwReveal,
    nsfwRevealedStatusIds,
    onStatusUpdate,
    onStatusDelete,
    onStatusEdit,
    supportsQuotes = false,
    deletedStatusRef,
    onDeletedStatusConsumed,
    isActive = true,
    zIndex,
}: ProfileModalProps) {
    // Instance config for supportsQuotes — resolves internally instead of requiring prop
    const { instanceConfig: profileInstanceConfig } = useInstanceConfig({
        accountSession,
        isOpen,
    });
    const resolvedSupportsQuotes = supportsQuotes || profileInstanceConfig?.supportsQuotes === true;

    const [fullAccount, setFullAccount] = useState<mastodon.v1.Account | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Post list state
    const [statuses, setStatuses] = useState<mastodon.v1.Status[]>([]);
    const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
    const [hasMoreStatuses, setHasMoreStatuses] = useState(true);
    const [statusesError, setStatusesError] = useState<string | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Ref to track statuses for pagination without causing callback recreation
    const statusesRef = useRef<mastodon.v1.Status[]>([]);

    // Request ID ref for stale response detection
    const statusesRequestIdRef = useRef(0);

    // Tab state
    const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

    // Followers list state
    const [followers, setFollowers] = useState<mastodon.v1.Account[]>([]);
    const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);
    const [hasMoreFollowers, setHasMoreFollowers] = useState(true);
    const [followersError, setFollowersError] = useState<string | null>(null);
    const [followersLoaded, setFollowersLoaded] = useState(false);
    const loadMoreFollowersRef = useRef<HTMLDivElement>(null);
    const followersRef = useRef<mastodon.v1.Account[]>([]);
    const followersRequestIdRef = useRef(0);

    // Following list state
    const [followingList, setFollowingList] = useState<mastodon.v1.Account[]>([]);
    const [isLoadingFollowingList, setIsLoadingFollowingList] = useState(false);
    const [hasMoreFollowingList, setHasMoreFollowingList] = useState(true);
    const [followingListError, setFollowingListError] = useState<string | null>(null);
    const [followingListLoaded, setFollowingListLoaded] = useState(false);
    const loadMoreFollowingListRef = useRef<HTMLDivElement>(null);
    const followingListRef = useRef<mastodon.v1.Account[]>([]);
    const followingListRequestIdRef = useRef(0);

    // Refs for focus management
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const tabPostsRef = useRef<HTMLButtonElement>(null);
    const tabFollowersRef = useRef<HTMLButtonElement>(null);
    const tabFollowingRef = useRef<HTMLButtonElement>(null);

    // Map tab names to refs for focus management
    const tabRefs = {
        posts: tabPostsRef,
        followers: tabFollowersRef,
        following: tabFollowingRef,
    } as const;

    const { handleKeyDown } = useModalAccessibility({
        isOpen: isOpen && isActive,
        onClose,
        closeButtonRef,
        modalRef,
        canClose: isActive,
    });

    // Extract stable ID for useEffect dependencies
    const accountId = account?.id;

    // Stable account session ID for callbacks
    const accountSessionId = accountSession?.id;

    // Relationship actions hook for follow/unfollow functionality
    const {
        following,
        followedBy,
        requested,
        isLoading: isFollowLoading,
        isFetching: isRelationshipFetching,
        handleFollowToggle,
        isOwnProfile,
    } = useRelationshipActions({
        targetAccountId: accountId ?? null,
        accountSession,
    });

    // Stable callback wrappers to prevent React.memo invalidation in StatusCard
    // Using useMemo to memoize conditional expressions that return either a callback or undefined.
    const handleReply = useMemo(
        () =>
            onReply && accountSessionId
                ? (status: mastodon.v1.Status) => onReply(status, accountSessionId)
                : undefined,
        [onReply, accountSessionId]
    );
    const handleQuote = useMemo(
        () =>
            onQuote && accountSessionId
                ? (status: mastodon.v1.Status) => onQuote(status, accountSessionId)
                : undefined,
        [onQuote, accountSessionId]
    );
    const handleStatusClick = useMemo(
        () =>
            onStatusClick && accountSessionId
                ? (status: mastodon.v1.Status) => onStatusClick(status, accountSessionId)
                : undefined,
        [onStatusClick, accountSessionId]
    );
    // Wrap onStatusUpdate to also update local statuses array
    const handleStatusUpdate = useCallback(
        (updatedStatus: mastodon.v1.Status) => {
            // Update local state
            setStatuses((prev) => {
                const newStatuses = prev.map((s) =>
                    s.id === updatedStatus.id ? updatedStatus : s
                );
                statusesRef.current = newStatuses;
                return newStatuses;
            });
            // Call outer callback for global state update
            onStatusUpdate?.(updatedStatus);
        },
        [onStatusUpdate]
    );
    const handleStatusDelete = useMemo(
        () =>
            onStatusDelete && accountSessionId
                ? (status: mastodon.v1.Status) => onStatusDelete(status, accountSessionId)
                : undefined,
        [onStatusDelete, accountSessionId]
    );
    const handleStatusEdit = useMemo(
        () =>
            onStatusEdit && accountSessionId
                ? (status: mastodon.v1.Status) => onStatusEdit(status, accountSessionId)
                : undefined,
        [onStatusEdit, accountSessionId]
    );

    // Load initial statuses with stale response protection
    const loadStatuses = useCallback(async () => {
        if (!accountId || !accountSession) return;

        const reqId = ++statusesRequestIdRef.current;
        setIsLoadingStatuses(true);
        setStatusesError(null);

        try {
            const client: MastoClient = getClient(accountSession);
            const fetchedStatuses = await fetchAccountStatuses(client, accountId, {
                limit: PAGE_SIZE,
            });

            // Ignore stale response
            if (reqId !== statusesRequestIdRef.current) return;

            statusesRef.current = fetchedStatuses;
            setStatuses(fetchedStatuses);
            setHasMoreStatuses(fetchedStatuses.length === PAGE_SIZE);
        } catch (err) {
            if (reqId !== statusesRequestIdRef.current) return;
            console.error('Failed to fetch statuses:', err);
            setStatusesError('投稿の読み込みに失敗しました');
        } finally {
            if (reqId === statusesRequestIdRef.current) {
                setIsLoadingStatuses(false);
            }
        }
    }, [accountId, accountSession]);

    // Load more statuses for infinite scroll
    const loadMoreStatuses = useCallback(async () => {
        if (!accountId || !accountSession || !hasMoreStatuses) return;

        const reqId = ++statusesRequestIdRef.current;
        setIsLoadingStatuses(true);
        setStatusesError(null);

        try {
            const client: MastoClient = getClient(accountSession);
            const lastStatusId = statusesRef.current[statusesRef.current.length - 1]?.id;

            const fetchedStatuses = await fetchAccountStatuses(client, accountId, {
                maxId: lastStatusId,
                limit: PAGE_SIZE,
            });

            // Ignore stale response
            if (reqId !== statusesRequestIdRef.current) return;

            if (fetchedStatuses.length > 0) {
                setStatuses((prev) => {
                    const newStatuses = [...prev, ...fetchedStatuses];
                    statusesRef.current = newStatuses;
                    return newStatuses;
                });
            }
            setHasMoreStatuses(fetchedStatuses.length === PAGE_SIZE);
        } catch (err) {
            if (reqId !== statusesRequestIdRef.current) return;
            console.error('Failed to fetch more statuses:', err);
            setStatusesError('投稿の読み込みに失敗しました');
            // Auto-loading is stopped by statusesError guard in observer
            // User can manually retry via reload button
        } finally {
            if (reqId === statusesRequestIdRef.current) {
                setIsLoadingStatuses(false);
            }
        }
    }, [accountId, accountSession, hasMoreStatuses]);

    // Load initial followers
    const loadFollowers = useCallback(async () => {
        if (!accountId || !accountSession) return;

        const reqId = ++followersRequestIdRef.current;
        setIsLoadingFollowers(true);
        setFollowersError(null);

        try {
            const client: MastoClient = getClient(accountSession);
            const fetchedFollowers = await fetchAccountFollowers(client, accountId, {
                limit: PAGE_SIZE,
            });

            // Ignore stale response
            if (reqId !== followersRequestIdRef.current) return;

            followersRef.current = fetchedFollowers;
            setFollowers(fetchedFollowers);
            setHasMoreFollowers(fetchedFollowers.length === PAGE_SIZE);
            setFollowersLoaded(true);
        } catch (err) {
            if (reqId !== followersRequestIdRef.current) return;
            console.error('Failed to fetch followers:', err);
            setFollowersError('フォロワーの読み込みに失敗しました');
        } finally {
            if (reqId === followersRequestIdRef.current) {
                setIsLoadingFollowers(false);
            }
        }
    }, [accountId, accountSession]);

    // Load more followers for infinite scroll
    const loadMoreFollowers = useCallback(async () => {
        if (!accountId || !accountSession || !hasMoreFollowers) return;

        const reqId = ++followersRequestIdRef.current;
        setIsLoadingFollowers(true);
        setFollowersError(null);

        try {
            const client: MastoClient = getClient(accountSession);
            const lastFollowerId = followersRef.current[followersRef.current.length - 1]?.id;

            const fetchedFollowers = await fetchAccountFollowers(client, accountId, {
                maxId: lastFollowerId,
                limit: PAGE_SIZE,
            });

            // Ignore stale response
            if (reqId !== followersRequestIdRef.current) return;

            if (fetchedFollowers.length > 0) {
                setFollowers((prev) => {
                    const newFollowers = [...prev, ...fetchedFollowers];
                    followersRef.current = newFollowers;
                    return newFollowers;
                });
            }
            setHasMoreFollowers(fetchedFollowers.length === PAGE_SIZE);
        } catch (err) {
            if (reqId !== followersRequestIdRef.current) return;
            console.error('Failed to fetch more followers:', err);
            setFollowersError('フォロワーの読み込みに失敗しました');
        } finally {
            if (reqId === followersRequestIdRef.current) {
                setIsLoadingFollowers(false);
            }
        }
    }, [accountId, accountSession, hasMoreFollowers]);

    // Load initial following
    const loadFollowingList = useCallback(async () => {
        if (!accountId || !accountSession) return;

        const reqId = ++followingListRequestIdRef.current;
        setIsLoadingFollowingList(true);
        setFollowingListError(null);

        try {
            const client: MastoClient = getClient(accountSession);
            const fetchedFollowing = await fetchAccountFollowing(client, accountId, {
                limit: PAGE_SIZE,
            });

            // Ignore stale response
            if (reqId !== followingListRequestIdRef.current) return;

            followingListRef.current = fetchedFollowing;
            setFollowingList(fetchedFollowing);
            setHasMoreFollowingList(fetchedFollowing.length === PAGE_SIZE);
            setFollowingListLoaded(true);
        } catch (err) {
            if (reqId !== followingListRequestIdRef.current) return;
            console.error('Failed to fetch following:', err);
            setFollowingListError('フォロー中の読み込みに失敗しました');
        } finally {
            if (reqId === followingListRequestIdRef.current) {
                setIsLoadingFollowingList(false);
            }
        }
    }, [accountId, accountSession]);

    // Load more following for infinite scroll
    const loadMoreFollowingList = useCallback(async () => {
        if (!accountId || !accountSession || !hasMoreFollowingList) return;

        const reqId = ++followingListRequestIdRef.current;
        setIsLoadingFollowingList(true);
        setFollowingListError(null);

        try {
            const client: MastoClient = getClient(accountSession);
            const lastFollowingId =
                followingListRef.current[followingListRef.current.length - 1]?.id;

            const fetchedFollowing = await fetchAccountFollowing(client, accountId, {
                maxId: lastFollowingId,
                limit: PAGE_SIZE,
            });

            // Ignore stale response
            if (reqId !== followingListRequestIdRef.current) return;

            if (fetchedFollowing.length > 0) {
                setFollowingList((prev) => {
                    const newFollowing = [...prev, ...fetchedFollowing];
                    followingListRef.current = newFollowing;
                    return newFollowing;
                });
            }
            setHasMoreFollowingList(fetchedFollowing.length === PAGE_SIZE);
        } catch (err) {
            if (reqId !== followingListRequestIdRef.current) return;
            console.error('Failed to fetch more following:', err);
            setFollowingListError('フォロー中の読み込みに失敗しました');
        } finally {
            if (reqId === followingListRequestIdRef.current) {
                setIsLoadingFollowingList(false);
            }
        }
    }, [accountId, accountSession, hasMoreFollowingList]);

    // Handle tab change
    const handleTabChange = useCallback(
        (tab: ProfileTab) => {
            setActiveTab(tab);
            // Load data when switching to a tab for the first time
            if (tab === 'followers' && !followersLoaded && !isLoadingFollowers) {
                loadFollowers();
            } else if (tab === 'following' && !followingListLoaded && !isLoadingFollowingList) {
                loadFollowingList();
            }
        },
        [
            followersLoaded,
            isLoadingFollowers,
            loadFollowers,
            followingListLoaded,
            isLoadingFollowingList,
            loadFollowingList,
        ]
    );

    // Handle keyboard navigation for tab list
    const handleTabListKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            const current = TAB_ORDER.indexOf(activeTab);
            let next = current;

            if (e.key === 'ArrowRight') {
                next = (current + 1) % TAB_ORDER.length;
            } else if (e.key === 'ArrowLeft') {
                next = (current - 1 + TAB_ORDER.length) % TAB_ORDER.length;
            } else if (e.key === 'Home') {
                next = 0;
            } else if (e.key === 'End') {
                next = TAB_ORDER.length - 1;
            } else {
                return;
            }

            e.preventDefault();
            handleTabChange(TAB_ORDER[next]);
            // Move focus to the newly selected tab (ARIA best practice)
            tabRefs[TAB_ORDER[next]].current?.focus();
        },
        [activeTab, handleTabChange]
    );

    // Reset state when modal closes or account changes, then fetch if available
    useEffect(() => {
        // Invalidate any pending requests
        statusesRequestIdRef.current += 1;
        followersRequestIdRef.current += 1;
        followingListRequestIdRef.current += 1;

        // Reset state when modal closes
        if (!isOpen) {
            setFullAccount(null);
            setHasError(false);
            setIsLoading(false);
            setStatuses([]);
            statusesRef.current = [];
            setHasMoreStatuses(true);
            setStatusesError(null);
            setIsLoadingStatuses(false);
            // Reset tab state
            setActiveTab('posts');
            // Reset followers state
            setFollowers([]);
            followersRef.current = [];
            setHasMoreFollowers(true);
            setFollowersError(null);
            setIsLoadingFollowers(false);
            setFollowersLoaded(false);
            // Reset following list state
            setFollowingList([]);
            followingListRef.current = [];
            setHasMoreFollowingList(true);
            setFollowingListError(null);
            setIsLoadingFollowingList(false);
            setFollowingListLoaded(false);
            return;
        }

        // Reset state when account changes (modal stays open but different account)
        setFullAccount(null);
        setHasError(false);
        setStatuses([]);
        statusesRef.current = [];
        setHasMoreStatuses(true);
        setStatusesError(null);
        setIsLoadingStatuses(false);
        // Reset tab state
        setActiveTab('posts');
        // Reset followers state
        setFollowers([]);
        followersRef.current = [];
        setHasMoreFollowers(true);
        setFollowersError(null);
        setIsLoadingFollowers(false);
        setFollowersLoaded(false);
        // Reset following list state
        setFollowingList([]);
        followingListRef.current = [];
        setHasMoreFollowingList(true);
        setFollowingListError(null);
        setIsLoadingFollowingList(false);
        setFollowingListLoaded(false);

        // Only fetch if we have both account and session
        if (!accountId || !accountSession) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        const fetchFullAccount = async () => {
            setIsLoading(true);

            try {
                const client: MastoClient = getClient(accountSession);
                const fetched = await fetchAccount(client, accountId);
                if (!cancelled) {
                    setFullAccount(fetched);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to fetch account:', err);
                    setHasError(true);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchFullAccount();
        loadStatuses();

        return () => {
            cancelled = true;
        };
    }, [isOpen, accountId, accountSession, loadStatuses]);

    // IntersectionObserver for infinite scroll (posts)
    useEffect(() => {
        // Only create observer when modal is open and posts tab is active
        if (!isOpen || activeTab !== 'posts') return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Don't auto-load if there's an error (user must manually retry)
                if (
                    entries[0].isIntersecting &&
                    hasMoreStatuses &&
                    !isLoadingStatuses &&
                    !statusesError
                ) {
                    loadMoreStatuses();
                }
            },
            { threshold: 0.1 }
        );

        const currentRef = loadMoreRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            observer.disconnect();
        };
    }, [isOpen, activeTab, hasMoreStatuses, isLoadingStatuses, statusesError, loadMoreStatuses]);

    // IntersectionObserver for infinite scroll (followers)
    useEffect(() => {
        // Only create observer when modal is open and followers tab is active
        if (!isOpen || activeTab !== 'followers') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (
                    entries[0].isIntersecting &&
                    hasMoreFollowers &&
                    !isLoadingFollowers &&
                    !followersError
                ) {
                    loadMoreFollowers();
                }
            },
            { threshold: 0.1 }
        );

        const currentRef = loadMoreFollowersRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            observer.disconnect();
        };
    }, [
        isOpen,
        activeTab,
        hasMoreFollowers,
        isLoadingFollowers,
        followersError,
        loadMoreFollowers,
    ]);

    // IntersectionObserver for infinite scroll (following)
    useEffect(() => {
        // Only create observer when modal is open and following tab is active
        if (!isOpen || activeTab !== 'following') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (
                    entries[0].isIntersecting &&
                    hasMoreFollowingList &&
                    !isLoadingFollowingList &&
                    !followingListError
                ) {
                    loadMoreFollowingList();
                }
            },
            { threshold: 0.1 }
        );

        const currentRef = loadMoreFollowingListRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            observer.disconnect();
        };
    }, [
        isOpen,
        activeTab,
        hasMoreFollowingList,
        isLoadingFollowingList,
        followingListError,
        loadMoreFollowingList,
    ]);

    // Remove deleted status from local list when deletion succeeds
    useEffect(() => {
        if (!isOpen || !deletedStatusRef || !accountSession) return;
        if (deletedStatusRef.accountSessionId !== accountSession.id) return;

        setStatuses((prev) => {
            const newStatuses = prev.filter((s) => s.id !== deletedStatusRef.statusId);
            statusesRef.current = newStatuses;
            return newStatuses;
        });
        // Notify parent that this status ref has been consumed
        onDeletedStatusConsumed?.();
    }, [isOpen, deletedStatusRef, accountSession?.id, onDeletedStatusConsumed]);

    if (!isOpen || !account) {
        return null;
    }

    const displayAccount = fullAccount ?? account;

    return (
        <div
            className="fixed inset-0 flex items-center justify-center"
            style={zIndex != null ? { zIndex } : undefined}
            onKeyDown={isActive ? handleKeyDown : undefined}
            role="dialog"
            aria-modal={isActive ? 'true' : undefined}
            aria-hidden={!isActive ? true : undefined}
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
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                        aria-label="閉じる"
                    >
                        <LuX className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="relative p-6 overflow-y-auto flex-1">
                    {/* Follow button and badge - top right of content area */}
                    {!isOwnProfile && displayAccount && (
                        <div className="absolute top-6 right-6 flex flex-col items-end gap-2 z-10">
                            {/* "Follows you" badge */}
                            {followedBy && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                                    フォローされています
                                </span>
                            )}

                            {/* Follow button */}
                            <button
                                type="button"
                                onClick={handleFollowToggle}
                                disabled={
                                    isFollowLoading || isRelationshipFetching || !accountSession
                                }
                                className={`
                                    inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm
                                    transition-all duration-200
                                    ${
                                        requested
                                            ? 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300'
                                            : following
                                              ? 'border border-slate-600 text-slate-300 hover:border-red-400 hover:text-red-400 disabled:hover:border-slate-600 disabled:hover:text-slate-300'
                                              : 'bg-indigo-500 hover:bg-indigo-600 text-white disabled:hover:bg-indigo-500'
                                    }
                                    ${
                                        isFollowLoading || isRelationshipFetching || !accountSession
                                            ? 'opacity-50 cursor-not-allowed'
                                            : ''
                                    }
                                `}
                                aria-label={
                                    isFollowLoading || isRelationshipFetching
                                        ? '処理中'
                                        : requested
                                          ? 'フォローリクエストをキャンセル'
                                          : following
                                            ? 'フォロー解除'
                                            : 'フォロー'
                                }
                                title={
                                    !accountSession
                                        ? 'アカウント接続が必要です'
                                        : requested
                                          ? 'フォローリクエストを送信済みです'
                                          : undefined
                                }
                            >
                                {isFollowLoading || isRelationshipFetching ? (
                                    <>
                                        <LuLoader
                                            className="w-4 h-4 animate-spin"
                                            aria-hidden="true"
                                        />
                                        <span>処理中...</span>
                                    </>
                                ) : requested ? (
                                    <>
                                        <LuUserPlus className="w-4 h-4" aria-hidden="true" />
                                        <span>リクエスト済み</span>
                                    </>
                                ) : following ? (
                                    <>
                                        <LuUserMinus className="w-4 h-4" aria-hidden="true" />
                                        <span>フォロー中</span>
                                    </>
                                ) : (
                                    <>
                                        <LuUserPlus className="w-4 h-4" aria-hidden="true" />
                                        <span>フォロー</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Loading indicator */}
                    {isLoading && !fullAccount && (
                        <div className="flex items-center justify-center py-8 text-slate-400">
                            <LuLoader className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />
                            <span>プロフィールを読み込み中...</span>
                        </div>
                    )}

                    {/* Error message */}
                    {hasError && !fullAccount && account && (
                        <div className="text-center py-2 text-amber-400 text-xs mb-4">
                            追加情報の取得に失敗しました
                        </div>
                    )}

                    {/* Profile content */}
                    {displayAccount && (
                        <div
                            className={`
                                flex flex-col items-center text-center
                                ${!isOwnProfile ? 'pt-16' : ''}
                            `}
                        >
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

                            {/* Stats as Tabs */}
                            <div
                                className="flex items-center justify-center gap-2 text-slate-400 text-sm w-full border-t border-slate-700/50 pt-4 flex-wrap"
                                role="tablist"
                                aria-label="プロフィールタブ"
                                onKeyDown={handleTabListKeyDown}
                            >
                                <button
                                    ref={tabPostsRef}
                                    id="tab-posts"
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'posts'}
                                    aria-controls="tabpanel-posts"
                                    tabIndex={activeTab === 'posts' ? 0 : -1}
                                    onClick={() => handleTabChange('posts')}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                                        activeTab === 'posts'
                                            ? 'text-slate-100 bg-slate-700/50'
                                            : 'hover:text-slate-200 hover:bg-slate-700/30'
                                    }`}
                                >
                                    <LuFileText className="w-4 h-4" aria-hidden="true" />
                                    <strong className="text-slate-200">
                                        {displayAccount.statusesCount}
                                    </strong>
                                    <span>投稿</span>
                                </button>
                                <button
                                    ref={tabFollowersRef}
                                    id="tab-followers"
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'followers'}
                                    aria-controls="tabpanel-followers"
                                    tabIndex={activeTab === 'followers' ? 0 : -1}
                                    onClick={() => handleTabChange('followers')}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                                        activeTab === 'followers'
                                            ? 'text-slate-100 bg-slate-700/50'
                                            : 'hover:text-slate-200 hover:bg-slate-700/30'
                                    }`}
                                >
                                    <LuUsers className="w-4 h-4" aria-hidden="true" />
                                    <strong className="text-slate-200">
                                        {displayAccount.followersCount}
                                    </strong>
                                    <span>フォロワー</span>
                                </button>
                                <button
                                    ref={tabFollowingRef}
                                    id="tab-following"
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'following'}
                                    aria-controls="tabpanel-following"
                                    tabIndex={activeTab === 'following' ? 0 : -1}
                                    onClick={() => handleTabChange('following')}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                                        activeTab === 'following'
                                            ? 'text-slate-100 bg-slate-700/50'
                                            : 'hover:text-slate-200 hover:bg-slate-700/30'
                                    }`}
                                >
                                    <LuUser className="w-4 h-4" aria-hidden="true" />
                                    <strong className="text-slate-200">
                                        {displayAccount.followingCount}
                                    </strong>
                                    <span>フォロー中</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab panels */}
                    <div className="mt-6 border-t border-slate-700/50 pt-4">
                        {/* Posts tab panel */}
                        <div
                            id="tabpanel-posts"
                            role="tabpanel"
                            aria-labelledby="tab-posts"
                            hidden={activeTab !== 'posts'}
                        >
                            {/* Statuses loading indicator */}
                            {isLoadingStatuses && statuses.length === 0 && (
                                <div className="flex items-center justify-center py-8 text-slate-400">
                                    <LuLoader
                                        className="w-5 h-5 animate-spin mr-2"
                                        aria-hidden="true"
                                    />
                                    <span>投稿を読み込み中...</span>
                                </div>
                            )}

                            {/* Statuses error */}
                            {statusesError && statuses.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                    <LuCircleAlert className="w-5 h-5 mb-2" aria-hidden="true" />
                                    <span className="mb-2">{statusesError}</span>
                                    <button
                                        type="button"
                                        onClick={() => loadStatuses()}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                    >
                                        <LuRefreshCw className="w-4 h-4" aria-hidden="true" />
                                        再読み込み
                                    </button>
                                </div>
                            )}

                            {/* Empty state */}
                            {!isLoadingStatuses && !statusesError && statuses.length === 0 && (
                                <div className="text-center py-8 text-slate-400">
                                    <span>投稿がありません</span>
                                </div>
                            )}

                            {/* Status list */}
                            {statuses.length > 0 && (
                                <div className="space-y-3">
                                    {statuses.map((status) => (
                                        <StatusCard
                                            key={status.id}
                                            status={status}
                                            accountSession={accountSession}
                                            onStatusUpdate={handleStatusUpdate}
                                            onReply={handleReply}
                                            onQuote={handleQuote}
                                            supportsQuotes={resolvedSupportsQuotes}
                                            onStatusClick={handleStatusClick}
                                            onImageClick={onImageClick}
                                            onVideoClick={onVideoClick}
                                            onAudioClick={onAudioClick}
                                            onAccountClick={onAccountClick}
                                            onNsfwReveal={onNsfwReveal}
                                            isNsfwRevealed={nsfwRevealedStatusIds?.has(status.id)}
                                            onStatusDelete={handleStatusDelete}
                                            onStatusEdit={handleStatusEdit}
                                        />
                                    ))}

                                    {/* Load more indicator */}
                                    <div ref={loadMoreRef} className="py-4">
                                        {isLoadingStatuses && statuses.length > 0 && (
                                            <div className="flex items-center justify-center text-slate-400">
                                                <LuLoader
                                                    className="w-4 h-4 animate-spin mr-2"
                                                    aria-hidden="true"
                                                />
                                                <span className="text-sm">読み込み中...</span>
                                            </div>
                                        )}
                                        {/* Pagination error - show retry button */}
                                        {statusesError && statuses.length > 0 && (
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <LuCircleAlert
                                                    className="w-4 h-4 mb-2"
                                                    aria-hidden="true"
                                                />
                                                <span className="text-sm mb-2">
                                                    {statusesError}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => loadMoreStatuses()}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                                >
                                                    <LuRefreshCw
                                                        className="w-4 h-4"
                                                        aria-hidden="true"
                                                    />
                                                    再読み込み
                                                </button>
                                            </div>
                                        )}
                                        {/* End of list - only show if no error */}
                                        {!hasMoreStatuses &&
                                            !statusesError &&
                                            statuses.length > 0 && (
                                                <div className="text-center text-slate-500 text-sm">
                                                    これ以上投稿はありません
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Followers tab panel */}
                        <div
                            id="tabpanel-followers"
                            role="tabpanel"
                            aria-labelledby="tab-followers"
                            hidden={activeTab !== 'followers'}
                        >
                            {/* Followers loading indicator */}
                            {isLoadingFollowers && followers.length === 0 && (
                                <div className="flex items-center justify-center py-8 text-slate-400">
                                    <LuLoader
                                        className="w-5 h-5 animate-spin mr-2"
                                        aria-hidden="true"
                                    />
                                    <span>フォロワーを読み込み中...</span>
                                </div>
                            )}

                            {/* Followers error */}
                            {followersError && followers.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                    <LuCircleAlert className="w-5 h-5 mb-2" aria-hidden="true" />
                                    <span className="mb-2">{followersError}</span>
                                    <button
                                        type="button"
                                        onClick={() => loadFollowers()}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                    >
                                        <LuRefreshCw className="w-4 h-4" aria-hidden="true" />
                                        再読み込み
                                    </button>
                                </div>
                            )}

                            {/* Empty state */}
                            {!isLoadingFollowers && !followersError && followers.length === 0 && (
                                <div className="text-center py-8 text-slate-400">
                                    <span>フォロワーがいません</span>
                                </div>
                            )}

                            {/* Followers list */}
                            {followers.length > 0 && (
                                <div className="space-y-1">
                                    {followers.map((followerAccount) => (
                                        <UserListItem
                                            key={followerAccount.id}
                                            account={followerAccount}
                                            onAccountClick={(acc) =>
                                                onAccountClick?.(acc, accountSessionId)
                                            }
                                        />
                                    ))}

                                    {/* Load more indicator */}
                                    <div ref={loadMoreFollowersRef} className="py-4">
                                        {isLoadingFollowers && followers.length > 0 && (
                                            <div className="flex items-center justify-center text-slate-400">
                                                <LuLoader
                                                    className="w-4 h-4 animate-spin mr-2"
                                                    aria-hidden="true"
                                                />
                                                <span className="text-sm">読み込み中...</span>
                                            </div>
                                        )}
                                        {followersError && followers.length > 0 && (
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <LuCircleAlert
                                                    className="w-4 h-4 mb-2"
                                                    aria-hidden="true"
                                                />
                                                <span className="text-sm mb-2">
                                                    {followersError}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => loadMoreFollowers()}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                                >
                                                    <LuRefreshCw
                                                        className="w-4 h-4"
                                                        aria-hidden="true"
                                                    />
                                                    再読み込み
                                                </button>
                                            </div>
                                        )}
                                        {!hasMoreFollowers &&
                                            !followersError &&
                                            followers.length > 0 && (
                                                <div className="text-center text-slate-500 text-sm">
                                                    これ以上フォロワーはいません
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Following tab panel */}
                        <div
                            id="tabpanel-following"
                            role="tabpanel"
                            aria-labelledby="tab-following"
                            hidden={activeTab !== 'following'}
                        >
                            {/* Following loading indicator */}
                            {isLoadingFollowingList && followingList.length === 0 && (
                                <div className="flex items-center justify-center py-8 text-slate-400">
                                    <LuLoader
                                        className="w-5 h-5 animate-spin mr-2"
                                        aria-hidden="true"
                                    />
                                    <span>フォロー中を読み込み中...</span>
                                </div>
                            )}

                            {/* Following error */}
                            {followingListError && followingList.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                    <LuCircleAlert className="w-5 h-5 mb-2" aria-hidden="true" />
                                    <span className="mb-2">{followingListError}</span>
                                    <button
                                        type="button"
                                        onClick={() => loadFollowingList()}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                    >
                                        <LuRefreshCw className="w-4 h-4" aria-hidden="true" />
                                        再読み込み
                                    </button>
                                </div>
                            )}

                            {/* Empty state */}
                            {!isLoadingFollowingList &&
                                !followingListError &&
                                followingList.length === 0 && (
                                    <div className="text-center py-8 text-slate-400">
                                        <span>フォロー中のユーザーがいません</span>
                                    </div>
                                )}

                            {/* Following list */}
                            {followingList.length > 0 && (
                                <div className="space-y-1">
                                    {followingList.map((followingAccount) => (
                                        <UserListItem
                                            key={followingAccount.id}
                                            account={followingAccount}
                                            onAccountClick={(acc) =>
                                                onAccountClick?.(acc, accountSessionId)
                                            }
                                        />
                                    ))}

                                    {/* Load more indicator */}
                                    <div ref={loadMoreFollowingListRef} className="py-4">
                                        {isLoadingFollowingList && followingList.length > 0 && (
                                            <div className="flex items-center justify-center text-slate-400">
                                                <LuLoader
                                                    className="w-4 h-4 animate-spin mr-2"
                                                    aria-hidden="true"
                                                />
                                                <span className="text-sm">読み込み中...</span>
                                            </div>
                                        )}
                                        {followingListError && followingList.length > 0 && (
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <LuCircleAlert
                                                    className="w-4 h-4 mb-2"
                                                    aria-hidden="true"
                                                />
                                                <span className="text-sm mb-2">
                                                    {followingListError}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => loadMoreFollowingList()}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                                >
                                                    <LuRefreshCw
                                                        className="w-4 h-4"
                                                        aria-hidden="true"
                                                    />
                                                    再読み込み
                                                </button>
                                            </div>
                                        )}
                                        {!hasMoreFollowingList &&
                                            !followingListError &&
                                            followingList.length > 0 && (
                                                <div className="text-center text-slate-500 text-sm">
                                                    これ以上フォロー中のユーザーはいません
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
