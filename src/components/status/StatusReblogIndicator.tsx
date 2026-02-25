import React from 'react';
import type { mastodon } from 'masto';
import { LuRepeat2 } from 'react-icons/lu';
import { DisplayName } from '../DisplayName';

interface StatusReblogIndicatorProps {
    /** The account that reblogged the status */
    reblogger: mastodon.v1.Account;
    /** Size variant for styling */
    variant?: 'card' | 'detail';
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays a reblog indicator showing who boosted the status.
 * Used in StatusCard and StatusDetailModal.
 */
export const StatusReblogIndicator = React.memo(function StatusReblogIndicator({
    reblogger,
    variant = 'card',
    className = '',
}: StatusReblogIndicatorProps) {
    const avatarSize = variant === 'detail' ? 'w-5 h-5' : 'w-4 h-4';
    const marginClass = variant === 'card' ? 'mb-2 ml-12' : 'mb-3';

    return (
        <div
            className={`flex items-center gap-2 text-sm text-slate-400 ${marginClass} ${className}`}
        >
            <LuRepeat2 className="text-green-400" aria-hidden="true" />
            <img src={reblogger.avatar} alt="" className={`${avatarSize} rounded`} />
            <span className={variant === 'card' ? 'truncate' : ''}>
                <DisplayName account={reblogger} /> がブースト
            </span>
        </div>
    );
});
