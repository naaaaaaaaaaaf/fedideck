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
