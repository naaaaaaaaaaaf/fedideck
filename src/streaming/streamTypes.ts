export type StreamType =
    | 'home'
    | 'notifications'
    | 'public'
    | 'public:local'
    | 'list'
    | 'hashtag';

export interface StreamConfig {
    type: StreamType;
    listId?: string;     // Required for 'list' type
    hashtag?: string;    // Required for 'hashtag' type
}

export interface StreamEvent {
    stream: StreamType;
    event: 'update' | 'delete' | 'notification' | 'status.update';
    payload: unknown;
}

/**
 * Get display name for a stream type
 */
export function getStreamDisplayName(config: StreamConfig): string {
    switch (config.type) {
        case 'home':
            return 'ホーム';
        case 'notifications':
            return '通知';
        case 'public':
            return '連合タイムライン';
        case 'public:local':
            return 'ローカルタイムライン';
        case 'list':
            return `リスト`;
        case 'hashtag':
            return `#${config.hashtag}`;
        default:
            return 'Unknown';
    }
}

/**
 * Get icon class for a stream type
 */
export function getStreamIcon(type: StreamType): string {
    switch (type) {
        case 'home':
            return '🏠';
        case 'notifications':
            return '🔔';
        case 'public':
            return '🌐';
        case 'public:local':
            return '👥';
        case 'list':
            return '📋';
        case 'hashtag':
            return '#';
        default:
            return '📄';
    }
}
