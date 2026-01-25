import type { ReactNode } from 'react';
import { LuHouse, LuBell, LuGlobe, LuUsers, LuList, LuHash, LuFileText } from 'react-icons/lu';

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
            return `#${config.hashtag || 'ハッシュタグ'}`;
        default:
            return 'Unknown';
    }
}

/**
 * Get icon component for a stream type
 */
export function getStreamIcon(type: StreamType): ReactNode {
    switch (type) {
        case 'home':
            return <LuHouse />;
        case 'notifications':
            return <LuBell />;
        case 'public':
            return <LuGlobe />;
        case 'public:local':
            return <LuUsers />;
        case 'list':
            return <LuList />;
        case 'hashtag':
            return <LuHash />;
        default:
            return <LuFileText />;
    }
}
