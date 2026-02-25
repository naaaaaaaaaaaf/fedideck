import React from 'react';
import type { mastodon } from 'masto';
import { LuCornerUpLeft } from 'react-icons/lu';

interface StatusReplyIndicatorProps {
    /** The ID of the status this is replying to */
    inReplyToId: string | null;
    /** The ID of the account this is replying to */
    inReplyToAccountId: string | null;
    /** Mentions in the status */
    mentions?: mastodon.v1.Status['mentions'];
    /** Callback when clicked to view thread */
    onClick?: () => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays a reply indicator showing who the status is replying to.
 * Clickable when onClick is provided to navigate to the thread.
 */
export const StatusReplyIndicator = React.memo(function StatusReplyIndicator({
    inReplyToId,
    inReplyToAccountId,
    mentions,
    onClick,
    className = '',
}: StatusReplyIndicatorProps) {
    if (!inReplyToId) {
        return null;
    }

    // Find reply target from mentions using inReplyToAccountId
    const replyToMention = mentions?.find((m) => m.id === inReplyToAccountId);
    const replyText = replyToMention ? `@${replyToMention.acct} への返信` : '返信';

    const isClickable = !!onClick;

    const clickableProps = isClickable
        ? {
              onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onClick();
              },
              role: 'button' as const,
              tabIndex: 0,
              onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onClick();
                  }
              },
              'aria-label': 'スレッドを表示',
          }
        : {};

    return (
        <div
            className={`flex items-center gap-2 text-sm text-slate-400 mb-2 ml-12 ${
                isClickable ? 'cursor-pointer hover:text-slate-300' : ''
            } ${className}`}
            {...clickableProps}
        >
            <LuCornerUpLeft className="text-blue-400" aria-hidden="true" />
            <span className="truncate">{replyText}</span>
        </div>
    );
});
