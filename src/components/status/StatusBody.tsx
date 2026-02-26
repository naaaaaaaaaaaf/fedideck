import React, { useMemo } from 'react';
import type { mastodon } from 'masto';
import { LuTriangleAlert } from 'react-icons/lu';
import { replaceEmojisWithImages } from '../../utils/emoji';
import { stripQuoteInline } from '../../utils/statusView';

interface StatusBodyProps {
    /** HTML content of the status */
    content: string;
    /** Custom emojis for content replacement */
    emojis: mastodon.v1.CustomEmoji[];
    /** Content warning / spoiler text (if any) */
    spoilerText?: string;
    /** Size variant for styling */
    variant?: 'card' | 'detail' | 'thread';
    /** Additional CSS classes */
    className?: string;
    /** Whether the status has a quote (to strip quote-inline elements) */
    hasQuote?: boolean;
}

/**
 * Displays status body with optional content warning.
 * Handles emoji replacement and supports multiple size variants.
 */
export const StatusBody = React.memo(function StatusBody({
    content,
    emojis,
    spoilerText,
    variant = 'card',
    className = '',
    hasQuote = false,
}: StatusBodyProps) {
    // Strip quote-inline elements if status has a quote
    const processedContent = useMemo(
        () => (hasQuote ? stripQuoteInline(content) : content),
        [content, hasQuote]
    );

    // Emoji processing for content
    const contentWithEmojis = useMemo(
        () => replaceEmojisWithImages(processedContent, emojis),
        [processedContent, emojis]
    );

    const isDetail = variant === 'detail';

    // Variant-specific styles
    const detailsClass = isDetail ? 'mb-4' : 'mt-2';
    const summaryClass = isDetail
        ? 'cursor-pointer text-amber-400 mb-2'
        : 'cursor-pointer text-amber-400 text-sm';
    const contentClass = isDetail
        ? 'text-slate-200 text-lg leading-relaxed status-content'
        : 'mt-2 text-slate-200 wrap-break-word status-content';
    const mainContentClass = isDetail
        ? 'text-slate-200 text-lg leading-relaxed mb-4 status-content'
        : 'mt-2 text-slate-200 wrap-break-word status-content';

    return (
        <div className={className}>
            {/* Content Warning */}
            {spoilerText && (
                <details className={detailsClass} open={isDetail}>
                    <summary className={summaryClass}>
                        <LuTriangleAlert className="inline mr-1" aria-hidden="true" /> {spoilerText}
                    </summary>
                    <div
                        className={contentClass}
                        dangerouslySetInnerHTML={{ __html: contentWithEmojis }}
                    />
                </details>
            )}

            {/* Main content */}
            {!spoilerText && (
                <div
                    className={mainContentClass}
                    dangerouslySetInnerHTML={{ __html: contentWithEmojis }}
                />
            )}
        </div>
    );
});
