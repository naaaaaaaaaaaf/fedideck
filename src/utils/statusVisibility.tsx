import { LuGlobe, LuLockOpen, LuLock, LuMail } from 'react-icons/lu';
import type { IconType } from 'react-icons';
import type { ReactNode } from 'react';

/**
 * Mastodon status visibility types
 */
export type Visibility = 'public' | 'unlisted' | 'private' | 'direct';

/**
 * Metadata for a visibility level, including display label, icon, and description
 */
export interface VisibilityMeta {
    label: string;
    icon: IconType;
    description: string;
}

/**
 * Mapping of visibility types to their display metadata (Japanese labels, Lucide icons, and descriptions)
 */
export const VISIBILITY_META: Record<Visibility, VisibilityMeta> = {
    public: {
        label: '公開',
        icon: LuGlobe,
        description: '全員に表示',
    },
    unlisted: {
        label: '未収載',
        icon: LuLockOpen,
        description: '公開タイムラインに表示しない',
    },
    private: {
        label: 'フォロワーのみ',
        icon: LuLock,
        description: 'フォロワーにのみ表示',
    },
    direct: {
        label: 'ダイレクト',
        icon: LuMail,
        description: 'メンションしたユーザーにのみ表示',
    },
};

/**
 * Ordered visibility values for UI display (e.g., dropdown options)
 */
export const VISIBILITY_ORDER: Visibility[] = ['public', 'unlisted', 'private', 'direct'];

const FALLBACK_META: VisibilityMeta = {
    label: '公開範囲不明',
    icon: LuGlobe,
    description: '',
};

/**
 * Returns the visibility metadata for a given visibility value.
 * Falls back to a default "unknown" meta for unrecognized values from federated instances.
 */
export function getVisibilityMeta(value: unknown): VisibilityMeta {
    if (typeof value === 'string' && Object.hasOwn(VISIBILITY_META, value)) {
        return VISIBILITY_META[value as Visibility];
    }
    return FALLBACK_META;
}

/**
 * Visibility option for UI components like dropdowns
 */
export interface VisibilityOption {
    value: Visibility;
    label: string;
    description: string;
    icon: ReactNode;
}

/**
 * Returns ordered visibility options for UI components.
 * Generates options from VISIBILITY_META with icons rendered as React elements.
 */
export function getVisibilityOptions(): VisibilityOption[] {
    return VISIBILITY_ORDER.map((visibility) => {
        const meta = VISIBILITY_META[visibility];
        const IconComponent = meta.icon;
        return {
            value: visibility,
            label: meta.label,
            description: meta.description,
            icon: <IconComponent aria-hidden="true" />,
        };
    });
}
