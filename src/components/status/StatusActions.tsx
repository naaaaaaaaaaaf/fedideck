import React from 'react';
import { LuMessageCircle, LuRepeat2, LuStar, LuBookmark } from 'react-icons/lu';
import { StatusMenu } from '../StatusMenu';

interface StatusActionsProps {
    /** Reply count */
    repliesCount: number;
    /** Reblog count */
    reblogsCount: number;
    /** Favourite count */
    favouritesCount: number;
    /** Whether the status is favourited */
    favourited: boolean;
    /** Whether the status is reblogged */
    reblogged: boolean;
    /** Whether the status is bookmarked */
    bookmarked: boolean;
    /** Whether the status can be reblogged */
    canReblog: boolean;
    /** Whether the user is authenticated (has account session) */
    isAuthenticated?: boolean;
    /** Loading states for actions */
    isLoading: { favourite: boolean; reblog: boolean; bookmark: boolean };
    /** Callback for reply action */
    onReply?: () => void;
    /** Callback for reblog action */
    onReblog: () => void;
    /** Callback for favourite action */
    onFavourite: () => void;
    /** Callback for bookmark action */
    onBookmark: () => void;
    /** Size variant for styling */
    variant?: 'card' | 'detail';
    /** Status URL for sharing */
    statusUrl: string;
    /** Whether the current user can delete the status */
    canDelete: boolean;
    /** Whether the current user can edit the status */
    canEdit: boolean;
    /** Callback for delete action */
    onDelete: () => void;
    /** Callback for edit action */
    onEdit: () => void;
    /** Whether reply is disabled */
    replyDisabled?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays action buttons for a status (reply, reblog, favourite, bookmark).
 * Supports card and detail variants with different layouts.
 */
export const StatusActions = React.memo(function StatusActions({
    repliesCount,
    reblogsCount,
    favouritesCount,
    favourited,
    reblogged,
    bookmarked,
    canReblog,
    isAuthenticated = true,
    isLoading,
    onReply,
    onReblog,
    onFavourite,
    onBookmark,
    variant = 'card',
    statusUrl,
    canDelete,
    canEdit,
    onDelete,
    onEdit,
    replyDisabled = false,
    className = '',
}: StatusActionsProps) {
    const isDetail = variant === 'detail';

    // Common action button base styles (WCAG 36px touch target for card variant)
    const actionButtonBase = isDetail
        ? 'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors'
        : 'inline-flex min-h-[36px] items-center justify-center gap-2 rounded-lg px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 disabled:opacity-50 disabled:cursor-not-allowed';

    const iconSize = isDetail ? 'w-5 h-5' : 'w-4 h-4';

    if (isDetail) {
        // Detail variant: spread out buttons with text labels
        return (
            <div
                className={`flex items-center justify-around text-slate-400 border-t border-slate-700/50 px-4 py-2 shrink-0 ${className}`}
            >
                <button
                    type="button"
                    onClick={onReply}
                    disabled={replyDisabled}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        replyDisabled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:text-blue-400 hover:bg-blue-400/10'
                    }`}
                >
                    <LuMessageCircle className={iconSize} aria-hidden="true" />
                    <span>返信</span>
                </button>
                <button
                    type="button"
                    onClick={onReblog}
                    disabled={!isAuthenticated || isLoading.reblog || !canReblog}
                    tabIndex={!isAuthenticated || !canReblog ? -1 : undefined}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        !isAuthenticated || !canReblog
                            ? 'opacity-50 cursor-not-allowed'
                            : reblogged
                              ? 'text-green-400 hover:bg-green-400/10'
                              : 'hover:text-green-400 hover:bg-green-400/10'
                    } ${isLoading.reblog ? 'opacity-50' : ''}`}
                    title={
                        !isAuthenticated
                            ? 'アカウント接続が必要です'
                            : !canReblog
                              ? 'この投稿はブーストできません'
                              : undefined
                    }
                >
                    <LuRepeat2 className={iconSize} aria-hidden="true" />
                    <span>ブースト</span>
                </button>
                <button
                    type="button"
                    onClick={onFavourite}
                    disabled={!isAuthenticated || isLoading.favourite}
                    tabIndex={!isAuthenticated ? -1 : undefined}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        !isAuthenticated
                            ? 'opacity-50 cursor-not-allowed'
                            : favourited
                              ? 'text-amber-400 hover:bg-amber-400/10'
                              : 'hover:text-amber-400 hover:bg-amber-400/10'
                    } ${isLoading.favourite ? 'opacity-50' : ''}`}
                    title={!isAuthenticated ? 'アカウント接続が必要です' : undefined}
                >
                    <LuStar
                        className={`${iconSize} ${favourited ? 'fill-current' : ''}`}
                        aria-hidden="true"
                    />
                    <span>お気に入り</span>
                </button>
                <button
                    type="button"
                    onClick={onBookmark}
                    disabled={!isAuthenticated || isLoading.bookmark}
                    tabIndex={!isAuthenticated ? -1 : undefined}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        !isAuthenticated
                            ? 'opacity-50 cursor-not-allowed'
                            : bookmarked
                              ? 'text-indigo-400 hover:bg-indigo-400/10'
                              : 'hover:text-indigo-400 hover:bg-indigo-400/10'
                    } ${isLoading.bookmark ? 'opacity-50' : ''}`}
                    title={!isAuthenticated ? 'アカウント接続が必要です' : undefined}
                >
                    <LuBookmark
                        className={`${iconSize} ${bookmarked ? 'fill-current' : ''}`}
                        aria-hidden="true"
                    />
                    <span>ブックマーク</span>
                </button>
                <StatusMenu
                    statusUrl={statusUrl}
                    canDelete={canDelete}
                    canEdit={canEdit}
                    onDelete={onDelete}
                    onEdit={onEdit}
                />
            </div>
        );
    }

    // Card variant: compact buttons with counts
    return (
        <div className={`flex items-center gap-2 mt-1 text-slate-400 ${className}`}>
            <button
                type="button"
                onClick={onReply}
                disabled={replyDisabled}
                className={`${actionButtonBase} ${
                    replyDisabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:text-blue-400 hover:bg-blue-400/10'
                }`}
                aria-label="返信"
            >
                <LuMessageCircle className={iconSize} aria-hidden="true" />
                {repliesCount > 0 && <span className="text-sm">{repliesCount}</span>}
            </button>
            <button
                type="button"
                onClick={onReblog}
                disabled={!isAuthenticated || isLoading.reblog || !canReblog}
                tabIndex={!isAuthenticated || !canReblog ? -1 : undefined}
                className={`${actionButtonBase} ${
                    !isAuthenticated || !canReblog
                        ? 'opacity-50 cursor-not-allowed'
                        : reblogged
                          ? 'text-green-400 hover:text-green-300 hover:bg-green-400/10'
                          : 'hover:text-green-400 hover:bg-green-400/10'
                } ${isLoading.reblog ? 'opacity-50' : ''}`}
                title={
                    !isAuthenticated
                        ? 'アカウント接続が必要です'
                        : !canReblog
                          ? 'この投稿はブーストできません'
                          : undefined
                }
                aria-label={reblogged ? 'ブースト解除' : 'ブースト'}
            >
                <LuRepeat2 className={iconSize} aria-hidden="true" />
                {reblogsCount > 0 && <span className="text-sm">{reblogsCount}</span>}
            </button>
            <button
                type="button"
                onClick={onFavourite}
                disabled={!isAuthenticated || isLoading.favourite}
                tabIndex={!isAuthenticated ? -1 : undefined}
                className={`${actionButtonBase} ${
                    !isAuthenticated
                        ? 'opacity-50 cursor-not-allowed'
                        : favourited
                          ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10'
                          : 'hover:text-amber-400 hover:bg-amber-400/10'
                } ${isLoading.favourite ? 'opacity-50' : ''}`}
                aria-label={favourited ? 'お気に入り解除' : 'お気に入り'}
                title={!isAuthenticated ? 'アカウント接続が必要です' : undefined}
            >
                <LuStar
                    className={`${iconSize} ${favourited ? 'fill-current' : ''}`}
                    aria-hidden="true"
                />
                {favouritesCount > 0 && <span className="text-sm">{favouritesCount}</span>}
            </button>
            <button
                type="button"
                onClick={onBookmark}
                disabled={!isAuthenticated || isLoading.bookmark}
                tabIndex={!isAuthenticated ? -1 : undefined}
                className={`${actionButtonBase} ${
                    !isAuthenticated
                        ? 'opacity-50 cursor-not-allowed'
                        : bookmarked
                          ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10'
                          : 'hover:text-indigo-400 hover:bg-indigo-400/10'
                } ${isLoading.bookmark ? 'opacity-50' : ''}`}
                aria-label={bookmarked ? 'ブックマーク解除' : 'ブックマーク'}
                title={!isAuthenticated ? 'アカウント接続が必要です' : undefined}
            >
                <LuBookmark
                    className={`${iconSize} ${bookmarked ? 'fill-current' : ''}`}
                    aria-hidden="true"
                />
            </button>
            <StatusMenu
                statusUrl={statusUrl}
                canDelete={canDelete}
                canEdit={canEdit}
                onDelete={onDelete}
                onEdit={onEdit}
                className="ml-auto"
            />
        </div>
    );
});
