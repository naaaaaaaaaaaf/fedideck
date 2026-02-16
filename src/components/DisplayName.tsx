import type { mastodon } from 'masto';
import React, { useMemo } from 'react';
import { replaceEmojisInPlainText } from '../utils/emoji';

interface DisplayNameProps {
    account: mastodon.v1.Account;
    className?: string;
}

/**
 * Renders an account's display name with custom emoji support.
 * The display name is always HTML-escaped first to prevent XSS,
 * then emoji shortcodes are replaced with img tags.
 * Falls back to username if displayName is empty.
 */
export const DisplayName = React.memo(function DisplayName({
    account,
    className,
}: DisplayNameProps) {
    const displayName = account.displayName || account.username;
    const hasEmojis = account.emojis && account.emojis.length > 0;

    // Memoize emoji replacement to avoid redundant processing
    const html = useMemo(() => {
        if (hasEmojis) {
            return replaceEmojisInPlainText(displayName, account.emojis);
        }
        return null;
    }, [displayName, account.emojis]);

    if (hasEmojis && html) {
        return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
    }

    // No emojis - render as plain text (React will escape automatically)
    return <span className={className}>{displayName}</span>;
});
