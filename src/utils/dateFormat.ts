/**
 * Format a date string to relative time in Japanese
 */
export function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '今';
    if (diffMins < 60) return `${diffMins}分`;
    if (diffHours < 24) return `${diffHours}時間`;
    if (diffDays < 7) return `${diffDays}日`;
    return date.toLocaleDateString('ja-JP');
}

/**
 * Format a date string to full Japanese date/time format
 * Used for accessibility labels and detailed timestamps
 */
export function formatFullDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Format time remaining until a future date
 * Returns null if date is null (poll never expires) or already past
 * @param expiresAt - ISO date string or null
 * @param nowMs - Current time in ms (defaults to Date.now(), injectable for testing)
 */
export function formatTimeRemaining(
    expiresAt: string | null,
    nowMs: number = Date.now()
): string | null {
    if (!expiresAt) return null;
    const expiryMs = Date.parse(expiresAt);
    if (Number.isNaN(expiryMs)) return null;

    const diffMs = expiryMs - nowMs;
    if (diffMs <= 0) return null;

    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return '残り1分未満';
    if (mins < 60) return `残り${mins}分`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `残り${hours}時間`;

    const days = Math.floor(hours / 24);
    return `残り${days}日`;
}
