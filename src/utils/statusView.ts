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
