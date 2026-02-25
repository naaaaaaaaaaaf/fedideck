import React from 'react';
import type { mastodon } from 'masto';
import { LuClock, LuBan, LuCircleAlert, LuTrash2, LuLoader } from 'react-icons/lu';
import { getQuoteStateMessage } from '../../utils/statusView';

interface StatusQuotePlaceholderProps {
    /** The quote state to display a placeholder for */
    state: mastodon.v1.QuoteState;
    /** Size variant for styling */
    variant?: 'card' | 'detail';
    /** Whether this is a ShallowQuote (only has quotedStatusId) */
    isShallow?: boolean;
}

/**
 * Get the icon for a quote state.
 */
function getQuoteStateIcon(state: mastodon.v1.QuoteState): React.ReactNode {
    switch (state) {
        case 'pending':
            return <LuClock className="text-amber-400" aria-hidden="true" />;
        case 'rejected':
        case 'unauthorized':
        case 'blocked_account':
        case 'blocked_domain':
            return <LuBan className="text-red-400" aria-hidden="true" />;
        case 'revoked':
        case 'muted_account':
            return <LuCircleAlert className="text-amber-400" aria-hidden="true" />;
        case 'deleted':
            return <LuTrash2 className="text-slate-400" aria-hidden="true" />;
        case 'accepted':
            return null; // Should not be used for accepted
        default:
            return <LuCircleAlert className="text-slate-400" aria-hidden="true" />;
    }
}

/**
 * Displays a placeholder for non-accepted quote states.
 * Shows appropriate message and icon based on the quote state.
 */
export const StatusQuotePlaceholder = React.memo(function StatusQuotePlaceholder({
    state,
    variant = 'card',
    isShallow = false,
}: StatusQuotePlaceholderProps) {
    const isDetail = variant === 'detail';
    const message = getQuoteStateMessage(state);

    // For accepted state with ShallowQuote, show loading message
    const displayMessage = state === 'accepted' && isShallow ? '引用を読み込み中...' : message;

    // If no message (accepted state without shallow), don't render
    if (!displayMessage) {
        return null;
    }

    const icon =
        state === 'accepted' && isShallow ? (
            <LuLoader className="text-slate-400 animate-spin" aria-hidden="true" />
        ) : (
            getQuoteStateIcon(state)
        );

    // Variant-specific styles
    const containerClass = isDetail
        ? 'mt-4 bg-slate-800/20 border border-slate-700/20 rounded-lg p-3'
        : 'mt-3 bg-slate-800/20 border border-slate-700/20 rounded-lg p-3';

    const textClass = isDetail ? 'text-sm' : 'text-xs';

    return (
        <div className={containerClass}>
            <div className={`flex items-center gap-2 text-slate-400 ${textClass}`}>
                {icon}
                <span>{displayMessage}</span>
            </div>
        </div>
    );
});
