import type { mastodon } from 'masto';

/**
 * Get the display status from a status object.
 * If the status is a reblog, returns the original (reblogged) status.
 * Otherwise, returns the status itself.
 *
 * @param status - The status object (may be a reblog)
 * @returns The status to display (original status for reblogs)
 */
export function getDisplayStatus(status: mastodon.v1.Status): mastodon.v1.Status {
    return status.reblog ?? status;
}

// ============================================================================
// Quote-related utility functions
// ============================================================================

/** Type for Quote or ShallowQuote */
type QuoteOrShallow = mastodon.v1.Quote | mastodon.v1.ShallowQuote;

/**
 * Check if a status has a quote.
 *
 * @param status - The status to check
 * @returns true if the status has a quote (Quote or ShallowQuote)
 */
export function hasQuote(status: mastodon.v1.Status): boolean {
    return status.quote != null;
}

/**
 * Type guard to check if a quote is a full Quote (with embedded quotedStatus).
 * ShallowQuote only has quotedStatusId, not the full Status object.
 * Note: Even if 'quotedStatus' key exists, it may be null, so we check for non-null value.
 *
 * @param quote - The quote object (Quote or ShallowQuote)
 * @returns true if this is a full Quote with non-null quotedStatus property
 */
export function isFullQuote(quote: QuoteOrShallow): quote is mastodon.v1.Quote {
    if (!('quotedStatus' in quote)) {
        return false;
    }
    return quote.quotedStatus != null;
}

/**
 * Get the quoted status if available.
 * Returns null if:
 * - No quote exists
 * - Quote is a ShallowQuote (no embedded status)
 * - Quote state is not 'accepted'
 * - quotedStatus is null/undefined
 *
 * @param status - The status containing the quote
 * @returns The quoted Status, or null if not available
 */
export function getQuotedStatus(status: mastodon.v1.Status): mastodon.v1.Status | null {
    const quote = status.quote;
    if (!quote) return null;
    if (quote.state !== 'accepted') return null;
    if (!isFullQuote(quote)) return null;
    return quote.quotedStatus ?? null;
}

/**
 * Get the quote state from a status.
 *
 * @param status - The status to check
 * @returns The QuoteState, or null if no quote exists
 */
export function getQuoteState(status: mastodon.v1.Status): mastodon.v1.QuoteState | null {
    return status.quote?.state ?? null;
}

/**
 * Get a human-readable message for non-accepted quote states.
 * Returns null for 'accepted' state (should show the actual card).
 *
 * @param state - The quote state
 * @returns Japanese message for the state, or null for accepted
 */
export function getQuoteStateMessage(state: mastodon.v1.QuoteState): string | null {
    const messages: Record<mastodon.v1.QuoteState, string | null> = {
        accepted: null, // Show actual card
        pending: '引用の承認待ち',
        rejected: '引用が拒否されました',
        revoked: '引用が取り消されました',
        deleted: '引用元の投稿が削除されました',
        unauthorized: '引用する権限がありません',
        blocked_account: 'ブロックしたアカウントの投稿です',
        blocked_domain: 'ブロックしたドメインの投稿です',
        muted_account: 'ミュートしたアカウントの投稿です',
    };
    return messages[state];
}

/**
 * Strip .quote-inline elements from HTML content.
 * Mastodon includes .quote-inline links in the status HTML, which would
 * cause double display when we render the quote card separately.
 *
 * @param html - The HTML content to process
 * @returns HTML with .quote-inline elements removed
 */
export function stripQuoteInline(html: string): string {
    // Quick check to avoid parsing when not needed
    if (!html.includes('quote-inline')) {
        return html;
    }

    // Use DOMParser to safely remove the elements
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const quoteInlineElements = doc.querySelectorAll('.quote-inline');
    quoteInlineElements.forEach((el) => el.remove());

    return doc.body.innerHTML;
}

/**
 * Get the display status from a nullable status object.
 * Returns null if the input is null/undefined.
 *
 * @param status - The status object (may be null, undefined, or a reblog)
 * @returns The status to display, or null if input is nullish
 */
export function getDisplayStatusOrNull(
    status: mastodon.v1.Status | null | undefined
): mastodon.v1.Status | null {
    if (!status) return null;
    return status.reblog ?? status;
}

/**
 * Check if a status has a content warning (spoiler text).
 *
 * @param status - The status to check
 * @returns true if the status has spoiler text
 */
export function hasContentWarning(status: mastodon.v1.Status): boolean {
    return Boolean(status.spoilerText);
}

/**
 * Get the reblogger account if the status is a reblog.
 *
 * @param status - The status object
 * @returns The reblogger account, or null if not a reblog
 */
export function getReblogger(status: mastodon.v1.Status): mastodon.v1.Account | null {
    return status.reblog ? status.account : null;
}
