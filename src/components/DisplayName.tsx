import type { mastodon } from 'masto';
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
export function DisplayName({ account, className }: DisplayNameProps) {
    const displayName = account.displayName || account.username;
    const hasEmojis = account.emojis && account.emojis.length > 0;

    // Always use replaceEmojisInPlainText to ensure HTML escaping
    // This function escapes the text first, then replaces emoji shortcodes
    if (hasEmojis) {
        const html = replaceEmojisInPlainText(displayName, account.emojis);
        return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
    }

    // No emojis - render as plain text (React will escape automatically)
    return <span className={className}>{displayName}</span>;
}
